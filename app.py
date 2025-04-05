import os
import zipfile
from flask import Flask, request, jsonify, send_from_directory, render_template, Response, stream_with_context, send_file, after_this_request
from werkzeug.utils import secure_filename
import json
import re
from typing import Generator, Dict, List
import tempfile
import logging
import email
from email import policy
from email.parser import Parser
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', static_url_path='')
# Increase max content length to 2GB
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = 'uploads'

# Initialize slack data storage
app.config['slack_data'] = {'channels': [], 'messages': {}}

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.static_folder, exist_ok=True)

def parse_rsmf_file(content: bytes) -> Dict:
    """Parse RSMF file content in MIME format."""
    try:
        # Try to parse as MIME message
        parser = Parser(policy=policy.default)
        msg = parser.parsestr(content.decode('utf-8', errors='replace'))

        # Extract metadata from headers
        metadata = {
            'timestamp': None,
            'from': msg.get('X-RSMF-Custodian', 'Unknown'),
            'event_count': msg.get('X-RSMF-EventCount', '0'),
            'begin_date': msg.get('X-RSMF-BeginDate', ''),
            'end_date': msg.get('X-RSMF-EndDate', ''),
            'version': msg.get('X-RSMF-Version', ''),
            'generator': msg.get('X-RSMF-Generator', '')
        }

        # Try to parse the begin date as timestamp
        if metadata['begin_date']:
            try:
                dt = datetime.fromisoformat(metadata['begin_date'].replace('Z', '+00:00'))
                metadata['timestamp'] = dt.timestamp()
            except ValueError:
                pass

        # Get the message content first
        message_text = ''
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == 'text/plain':
                    message_text = part.get_payload(decode=True).decode('utf-8', errors='replace')
                    break
        else:
            message_text = msg.get_payload(decode=True).decode('utf-8', errors='replace') if msg.get_payload() else msg.get_payload()

        # Create base message
        message = {
            'text': message_text,
            'user': metadata['from'],
            'ts': metadata['timestamp'] or '',
            'metadata': metadata,
            'attachments': []
        }

        # Look for attachments
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == 'application/zip':
                    zip_data = part.get_payload(decode=True)
                    if zip_data:
                        # Create a temporary file to store the zip
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
                            try:
                                temp_zip.write(zip_data)
                                temp_zip.flush()

                                # Open the zip and look for rsmf_manifest.json
                                with zipfile.ZipFile(temp_zip.name, 'r') as zip_ref:
                                    # Add all files in the zip as attachments
                                    for filename in zip_ref.namelist():
                                        if filename != 'rsmf_manifest.json':
                                            info = zip_ref.getinfo(filename)
                                            message['attachments'].append({
                                                'id': filename,
                                                'display': os.path.basename(filename),
                                                'size': info.file_size
                                            })

                                    # Parse manifest if it exists
                                    if 'rsmf_manifest.json' in zip_ref.namelist():
                                        with zip_ref.open('rsmf_manifest.json') as manifest_file:
                                            manifest_data = json.load(manifest_file)
                                            logger.info("Found and parsed rsmf_manifest.json")

                                            # Update message with manifest data if available
                                            if 'events' in manifest_data and len(manifest_data['events']) > 0:
                                                event = manifest_data['events'][0]  # Take first event
                                                if event.get('type') == 'message':
                                                    message.update({
                                                        'text': event.get('body', message['text']),
                                                        'user': event.get('participant', message['user']),
                                                        'ts': event.get('timestamp', message['ts']),
                                                        'thread_ts': event.get('parent'),
                                                        'reactions': event.get('reactions', [])
                                                    })
                            except Exception as e:
                                logger.error(f"Error processing zip attachment: {str(e)}")
                            finally:
                                os.unlink(temp_zip.name)

        return message

    except Exception as e:
        logger.error(f"Error parsing MIME content: {str(e)}")
        logger.exception("Full traceback:")
        # If MIME parsing fails, return the raw content
        return {
            'text': content.decode('utf-8', errors='replace'),
            'user': 'Unknown',
            'ts': '',
            'metadata': {}
        }

def process_zip_in_chunks(zip_path: str) -> Generator[Dict, None, None]:
    """Process ZIP file in chunks to avoid memory issues."""
    logger.info(f"Starting to process ZIP file: {zip_path}")

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # Log all files in the ZIP
        all_files = zip_ref.namelist()
        logger.info(f"All files in ZIP: {all_files}")

        # First find all RSMF files
        rsmf_files = [f for f in all_files if f.endswith('.rsmf')]
        logger.info(f"Found RSMF files: {rsmf_files}")

        # Group files by channel period
        channel_periods = set()
        for f in all_files:
            if 'Channels -' in f:
                parts = f.split('/')
                for part in parts:
                    if part.startswith('Channels -'):
                        channel_periods.add(part)
                        break

        logger.info(f"Found channel periods: {channel_periods}")

        # Create channels from the periods
        channels = []
        messages = {}
        for period in channel_periods:
            channel_name = period.replace('Channels - ', '')
            channels.append({
                'id': channel_name,
                'name': channel_name
            })
            messages[channel_name] = []

        logger.info(f"Created {len(channels)} channels")
        # Send channels as a single JSON object with newline
        yield json.dumps({'type': 'channels', 'data': channels}) + '\n'

        # Process messages from RSMF files
        for rsmf_file in rsmf_files:
            try:
                # Find which channel this file belongs to
                channel_name = None
                for period in channel_periods:
                    if period in rsmf_file:
                        channel_name = period.replace('Channels - ', '')
                        break

                if not channel_name:
                    logger.warning(f"Could not determine channel for file: {rsmf_file}")
                    continue

                with zip_ref.open(rsmf_file) as f:
                    content = f.read()
                    logger.info(f"Read {len(content)} bytes from {rsmf_file}")

                    # Parse RSMF content
                    message_data = parse_rsmf_file(content)
                    if message_data and message_data.get('text'):
                        # Clean and normalize the message text
                        if isinstance(message_data['text'], str):
                            # Replace any null bytes
                            message_data['text'] = message_data['text'].replace('\x00', '')
                            # Normalize newlines
                            message_data['text'] = message_data['text'].replace('\r\n', '\n').replace('\r', '\n')

                        messages[channel_name].append(message_data)
                        logger.info(f"Processed message from {rsmf_file} for channel {channel_name}")

                        try:
                            # Send each message as a properly formatted JSON string with newline
                            message_json = json.dumps({
                                'type': 'messages',
                                'channel': channel_name,
                                'data': [message_data]
                            }, ensure_ascii=False)
                            yield message_json + '\n'  # Add newline for proper NDJSON format
                        except Exception as e:
                            logger.error(f"Error serializing message to JSON: {str(e)}")
                            logger.error(f"Problematic message data: {message_data}")
                    else:
                        logger.warning(f"No message content found in {rsmf_file}")

            except Exception as e:
                logger.error(f"Error processing RSMF file {rsmf_file}: {str(e)}")
                logger.exception("Full traceback:")

        # Store complete data in app config
        app.config['slack_data'] = {
            'channels': channels,
            'messages': messages
        }
        logger.info("Completed processing ZIP file")

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return app.send_static_file('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    logger.info("Upload request received")

    if 'file' not in request.files:
        logger.error("No file part in request")
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        logger.error("No selected file")
        return jsonify({'error': 'No selected file'}), 400

    if not file.filename.endswith('.zip'):
        logger.error("File is not a ZIP")
        return jsonify({'error': 'File must be a ZIP file'}), 400

    logger.info(f"Processing file: {file.filename}")

    # Create a temporary file to store the upload
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        try:
            # Save uploaded file to temporary location
            file.save(temp_file.name)
            logger.info(f"File saved to temporary location: {temp_file.name}")

            # Store the zip file path in the app config
            app.config['current_zip_path'] = temp_file.name

            def generate():
                try:
                    for chunk in process_zip_in_chunks(temp_file.name):
                        logger.debug("Yielding chunk")
                        # Each chunk should already have a newline
                        yield chunk
                except Exception as e:
                    logger.error(f"Error in generate: {str(e)}")
                    logger.exception("Full traceback:")
                    # Yield error as a properly formatted chunk
                    yield json.dumps({
                        'type': 'error',
                        'data': {'message': str(e)}
                    }) + '\n'

            return Response(
                stream_with_context(generate()),
                mimetype='application/x-ndjson'
            )

        except Exception as e:
            logger.error(f"Error processing upload: {str(e)}")
            # Clean up temporary file in case of error
            os.unlink(temp_file.name)
            return jsonify({'error': str(e)}), 500

@app.route('/api/search', methods=['POST'])
def search_messages():
    data = request.json
    query = data.get('query', '')
    channel = data.get('channel', None)

    try:
        # Convert regex string to pattern
        pattern = re.compile(query, re.IGNORECASE)

        # Search through messages
        results = []
        messages_dict = app.config['slack_data'].get('messages', {})
        for channel_name, messages in messages_dict.items():
            if channel and channel_name != channel:
                continue

            for message in messages:
                if pattern.search(message.get('text', '')):
                    results.append({
                        'channel': channel_name,
                        'text': message.get('text', ''),
                        'user': message.get('user', ''),
                        'ts': message.get('ts', '')
                    })

        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/data/<path:attachment_id>')
def serve_attachment(attachment_id):
    """Serve attachment files from the currently loaded zip file."""
    logger.info(f"Request to serve attachment: {attachment_id}")

    # Get the current zip file path from the session or config
    current_zip = app.config.get('current_zip_path')
    if not current_zip or not os.path.exists(current_zip):
        logger.error("No zip file available")
        return "No zip file loaded", 404

    try:
        with zipfile.ZipFile(current_zip, 'r') as zip_ref:
            # Check if the file exists in the zip
            try:
                file_info = zip_ref.getinfo(attachment_id)
            except KeyError:
                logger.error(f"Attachment {attachment_id} not found in zip")
                return "File not found", 404

            # Extract the file to a temporary location
            temp_dir = tempfile.mkdtemp()
            extracted_path = zip_ref.extract(attachment_id, temp_dir)

            @after_this_request
            def cleanup(response):
                # Clean up the temporary file after sending
                try:
                    os.remove(extracted_path)
                    os.rmdir(temp_dir)
                except Exception as e:
                    logger.error(f"Error cleaning up temp file: {e}")
                return response

            # Determine the content type
            content_type = None
            if attachment_id.lower().endswith(('.jpg', '.jpeg')):
                content_type = 'image/jpeg'
            elif attachment_id.lower().endswith('.png'):
                content_type = 'image/png'
            elif attachment_id.lower().endswith('.gif'):
                content_type = 'image/gif'
            elif attachment_id.lower().endswith('.pdf'):
                content_type = 'application/pdf'

            return send_file(
                extracted_path,
                mimetype=content_type,
                as_attachment=True,
                download_name=os.path.basename(attachment_id)
            )

    except Exception as e:
        logger.error(f"Error serving attachment: {e}")
        logger.exception("Full traceback:")
        return str(e), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)