import React, { useState, useEffect } from 'react';
import {
  Box,
  CssBaseline,
  Container,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  TextField,
  Button,
  Typography,
  CircularProgress,
  LinearProgress,
  Alert,
  ListItemIcon,
  Link,
  Chip,
  Modal,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions
} from '@mui/material';
import { styled } from '@mui/material/styles';
import TagIcon from '@mui/icons-material/Tag';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import LinkIcon from '@mui/icons-material/Link';
import { InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { debounce } from '@mui/material/utils';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const Root = styled('div')({
  display: 'flex',
  minHeight: '100vh',
});

const Sidebar = styled(Paper)(({ theme }) => ({
  width: 240,
  padding: theme.spacing(2),
  backgroundColor: '#3F0E40',
  color: 'white',
}));

const MainContent = styled(Box)({
  flexGrow: 1,
  padding: '20px',
});

const SearchBox = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const MessageList = styled('div')({
  marginTop: '16px',
  padding: '16px',
  backgroundColor: '#fff',
  borderRadius: '4px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  overflowY: 'auto',
  height: 'calc(100vh - 200px)'
});

const UserAvatar = styled('div')(({ theme }) => ({
  width: '36px',
  height: '36px',
  borderRadius: '4px',
  backgroundColor: '#1164A3',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  fontWeight: 'bold',
  marginRight: '12px',
  flexShrink: 0
}));

const MessageContent = styled('div')({
  flex: 1,
  minWidth: 0, // Prevents content from overflowing
});

const MessageHeader = styled('div')({
  display: 'flex',
  alignItems: 'baseline',
  marginBottom: '4px',
});

const MessageText = styled(Typography)({
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: "'Lato', sans-serif",
  fontSize: '15px',
  lineHeight: '1.46668',
  fontWeight: 400,
  color: 'rgb(29, 28, 29)',
  '& mark': {
    backgroundColor: '#fce8b3',
    padding: '2px 0',
    borderRadius: '2px',
  },
  '& a': {
    color: '#1264a3',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline'
    }
  }
});

const DateDivider = styled('div')({
  display: 'flex',
  alignItems: 'center',
  margin: '28px 0',
  '&::before, &::after': {
    content: '""',
    flex: 1,
    height: '1px',
    backgroundColor: 'rgba(29, 28, 29, 0.13)',
  }
});

const DateText = styled(Typography)({
  margin: '0 16px',
  color: 'rgb(97, 96, 97)',
  fontSize: '14px',
  fontWeight: 600,
  textTransform: 'uppercase',
});

const MessageDivider = styled('div')({
  height: '1px',
  backgroundColor: 'rgba(29, 28, 29, 0.08)',
  margin: '16px 0',
});

// Move highlightText function here, before any components
const highlightText = (text, query) => {
  if (!query || !text) return text;
  try {
    // Create parts array only if we have a search query
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    if (parts.length === 1) return text;

    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  } catch (e) {
    return text;
  }
};

// Add this new function to parse URLs in text
const parseMessageText = (text, searchQuery) => {
  if (!text) return text;

  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  // Attachment pattern - matches the ID after "Attachment: "
  const attachmentPattern = /Attachment:\s*([a-zA-Z0-9_-]+)(?:\s|$)/g;
  // File attachment pattern - matches filenames with spaces
  const fileAttachmentPattern = /📎\s*((?:[^\s]+ )*[^\s]+\.(?:png|jpg|jpeg|gif|pdf|doc|docx|xls|xlsx|txt))\s+/g;
  // Google Docs ID pattern - matches IDs that start with "1" and are followed by alphanumeric chars
  const googleDocsIdPattern = /📎\s*(1[a-zA-Z0-9_-]+)/g;

  // Find all URLs and attachments while preserving their order
  const matches = [];
  let urlMatch;
  let attachmentMatch;
  let fileMatch;
  let googleDocsMatch;

  // Find all matches and store them with their positions
  while ((urlMatch = urlPattern.exec(text)) !== null) {
    matches.push({
      type: 'url',
      match: urlMatch[0],
      index: urlMatch.index,
      length: urlMatch[0].length
    });
  }

  while ((attachmentMatch = attachmentPattern.exec(text)) !== null) {
    matches.push({
      type: 'attachment',
      match: attachmentMatch[0],
      id: attachmentMatch[1],
      index: attachmentMatch.index,
      length: attachmentMatch[0].length
    });
  }

  while ((fileMatch = fileAttachmentPattern.exec(text)) !== null) {
    matches.push({
      type: 'file',
      match: fileMatch[0],
      filename: fileMatch[1],
      index: fileMatch.index,
      length: fileMatch[0].length
    });
  }

  while ((googleDocsMatch = googleDocsIdPattern.exec(text)) !== null) {
    matches.push({
      type: 'googledoc',
      match: googleDocsMatch[0],
      id: googleDocsMatch[1],
      index: googleDocsMatch.index,
      length: googleDocsMatch[0].length
    });
  }

  // Sort matches by their position in the text
  matches.sort((a, b) => a.index - b.index);

  // Process text with matches
  let currentIndex = 0;
  const elements = [];

  matches.forEach((item, i) => {
    // Add text before the match
    if (item.index > currentIndex) {
      const beforeText = text.slice(currentIndex, item.index);
      elements.push(highlightText(beforeText, searchQuery));
    }

    if (item.type === 'url') {
      elements.push(
        <Link
          key={`url-${i}`}
          href={item.match}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: '#1264a3',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          {item.match}
        </Link>
      );
    } else if (item.type === 'attachment') {
      elements.push(
        <Box
          key={`inline-attachment-${i}`}
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'rgba(29, 28, 29, 0.04)',
            padding: '2px 6px',
            borderRadius: '4px',
            margin: '0 2px',
            color: '#1d1c1d',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'rgba(29, 28, 29, 0.08)'
            }
          }}
        >
          <AttachFileIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
          {item.id}
        </Box>
      );
    } else if (item.type === 'file') {
      elements.push(
        <Link
          key={`file-${i}`}
          href={`/api/attachments/${encodeURIComponent(item.filename)}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            color: '#1264a3',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          <AttachFileIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
          {item.filename}
        </Link>
      );
    } else if (item.type === 'googledoc') {
      elements.push(
        <Box
          key={`googledoc-${i}`}
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'rgba(29, 28, 29, 0.04)',
            padding: '2px 6px',
            borderRadius: '4px',
            margin: '0 2px',
            color: '#1d1c1d',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'rgba(29, 28, 29, 0.08)'
            }
          }}
        >
          <InsertDriveFileIcon sx={{ fontSize: 16, mr: 0.5 }} />
          <Link
            href={`https://docs.google.com/document/d/${item.id}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: '#1264a3',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            {item.id}
          </Link>
        </Box>
      );
    }

    currentIndex = item.index + item.length;
  });

  // Add any remaining text
  if (currentIndex < text.length) {
    elements.push(highlightText(text.slice(currentIndex), searchQuery));
  }

  return elements;
};

const MessageItem = ({ message, searchQuery, showAvatar = true }) => {
  // Get initials from user name
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format timestamp
  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(parseFloat(ts) * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Box sx={{
      display: 'flex',
      padding: '4px 20px',
      '&:hover': {
        backgroundColor: 'rgba(248, 248, 248, 1)'
      }
    }}>
      {showAvatar ? (
        <UserAvatar>
          {getInitials(message.user || 'Unknown User')}
        </UserAvatar>
      ) : (
        <Box sx={{ width: 36, marginRight: '12px' }} />
      )}
      <MessageContent>
        {showAvatar && (
          <MessageHeader>
            <Typography
              component="span"
              sx={{
                fontWeight: 'bold',
                fontSize: '15px',
                color: '#1d1c1d',
                marginRight: '8px',
                '&:hover': {
                  color: '#1264a3',
                  cursor: 'pointer'
                }
              }}
            >
              {message.user || 'Unknown User'}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: '12px',
                color: '#616061',
                '&:hover': {
                  color: '#1d1c1d',
                  cursor: 'pointer'
                }
              }}
            >
              {formatTimestamp(message.ts)}
            </Typography>
          </MessageHeader>
        )}
        {!showAvatar && (
          <Typography
            component="span"
            sx={{
              fontSize: '12px',
              color: '#616061',
              cursor: 'pointer',
              '&:hover': {
                color: '#1d1c1d'
              }
            }}
          >
            {formatTimestamp(message.ts)}
          </Typography>
        )}

        <MessageText variant="body1">
          {parseMessageText(message.text, searchQuery)}
        </MessageText>

        {message.attachments && message.attachments.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {message.attachments.map((attachment, i) => (
              <MessageAttachment key={i} attachment={attachment} />
            ))}
          </Box>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <Box sx={{
            mt: 1,
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap'
          }}>
            {message.reactions.map((reaction, i) => (
              <Chip
                key={i}
                size="small"
                label={`${reaction.value} ${reaction.count}`}
                sx={{
                  backgroundColor: 'rgba(29, 28, 29, 0.04)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  height: '24px',
                  '&:hover': {
                    backgroundColor: 'rgba(29, 28, 29, 0.08)',
                    cursor: 'pointer'
                  }
                }}
              />
            ))}
          </Box>
        )}
      </MessageContent>
    </Box>
  );
};

const MessageGroup = ({ messages, searchQuery }) => {
  // Group messages by date
  const messagesByDate = messages.reduce((groups, message) => {
    const date = new Date(message.ts * 1000);
    const dateKey = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {});

  return (
    <>
      {Object.entries(messagesByDate).map(([date, dateMessages], index) => (
        <React.Fragment key={date}>
          <DateDivider>
            <DateText>{date}</DateText>
          </DateDivider>
          {dateMessages.map((message, messageIndex) => (
            <React.Fragment key={`${message.ts}-${messageIndex}`}>
              <Box
                sx={{
                  display: 'flex',
                  padding: '8px 20px',
                  '&:hover': {
                    backgroundColor: 'rgba(29, 28, 29, 0.04)',
                  }
                }}
              >
                <UserAvatar>
                  {message.user ? message.user.charAt(0).toUpperCase() : '?'}
                </UserAvatar>
                <MessageContent>
                  <MessageHeader>
                    <Typography
                      component="span"
                      sx={{
                        fontWeight: 900,
                        fontSize: '15px',
                        color: 'rgb(29, 28, 29)',
                        marginRight: '8px',
                      }}
                    >
                      {message.user}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{
                        color: 'rgb(97, 96, 97)',
                        fontSize: '12px',
                      }}
                    >
                      {new Date(message.ts * 1000).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </Typography>
                  </MessageHeader>
                  <MessageText>
                    {parseMessageText(message.text, searchQuery)}
                  </MessageText>
                  {message.attachments && message.attachments.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {message.attachments.map((attachment, i) => (
                        <MessageAttachment key={i} attachment={attachment} />
                      ))}
                    </Box>
                  )}
                </MessageContent>
              </Box>
              {messageIndex < dateMessages.length - 1 && <MessageDivider />}
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </>
  );
};

const AttachmentModal = ({ open, onClose, attachment }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
          maxWidth: '90vw',
        }
      }}
    >
      <DialogTitle>
        {attachment?.display}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {attachment?.display?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
          <Box
            component="img"
            src={`data/${attachment.id}`}
            alt={attachment.display}
            sx={{
              maxWidth: '100%',
              maxHeight: 'calc(90vh - 120px)',
              objectFit: 'contain',
            }}
          />
        ) : (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <InsertDriveFileIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography>
              Click the button below to download the file
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          href={`data/${attachment?.id}`}
          download={attachment?.display}
          variant="contained"
          startIcon={<DownloadIcon />}
        >
          Download
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const MessageAttachment = ({ attachment }) => {
  const [modalOpen, setModalOpen] = useState(false);

  const getIcon = () => {
    if (attachment.display.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <ImageIcon />;
    }
    return <InsertDriveFileIcon />;
  };

  const handleClick = (e) => {
    e.preventDefault();
    setModalOpen(true);
  };

  return (
    <>
      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
        <Paper
          sx={{
            p: 1,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              cursor: 'pointer'
            }
          }}
          onClick={handleClick}
        >
          {getIcon()}
          <Typography
            sx={{
              ml: 1,
              color: '#1264a3',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            {attachment.display}
          </Typography>
          {attachment.size && (
            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
              ({Math.round(attachment.size / 1024)}KB)
            </Typography>
          )}
        </Paper>
      </Box>
      <AttachmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        attachment={attachment}
      />
    </>
  );
};

function App() {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [messages, setMessages] = useState([]);
  const [allMessages, setAllMessages] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  const debouncedSearch = React.useMemo(
    () =>
      debounce((query) => {
        if (!selectedChannel || !allMessages[selectedChannel]) {
          setFilteredMessages([]);
          return;
        }

        if (!query) {
          setFilteredMessages(allMessages[selectedChannel]);
          return;
        }

        const searchStr = query.toLowerCase();
        const messages = allMessages[selectedChannel];
        const filtered = [];

        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];

          // Check text first as it's most common
          if (message.text?.toLowerCase().includes(searchStr)) {
            filtered.push(message);
            continue;
          }

          // Check user only if needed
          if (message.user?.toLowerCase().includes(searchStr)) {
            filtered.push(message);
            continue;
          }

          // Check attachments only if needed
          if (message.attachments?.length) {
            for (let j = 0; j < message.attachments.length; j++) {
              if (message.attachments[j].display?.toLowerCase().includes(searchStr)) {
                filtered.push(message);
                break;
              }
            }
          }
        }

        setFilteredMessages(filtered);
      }, 300),
    [selectedChannel, allMessages]
  );

  // Cleanup the debounced function on unmount
  React.useEffect(() => {
    return () => {
      debouncedSearch.clear();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    if (!selectedChannel || !allMessages[selectedChannel]) {
      setFilteredMessages([]);
      return;
    }

    if (!searchQuery) {
      setFilteredMessages(allMessages[selectedChannel]);
      return;
    }

    // Use the debounced search
    debouncedSearch(searchQuery);
  }, [selectedChannel, allMessages, searchQuery, debouncedSearch]);

  useEffect(() => {
    if (selectedChannel && allMessages[selectedChannel]) {
      console.log(`Displaying messages for channel ${selectedChannel}:`, allMessages[selectedChannel]);
      setMessages(allMessages[selectedChannel]);
    } else {
      setMessages([]);
    }
  }, [selectedChannel, allMessages]);

  const handleChannelSelect = (channelName) => {
    console.log(`Selected channel: ${channelName}`);
    setSelectedChannel(channelName);
    setSearchQuery('');  // Clear search when changing channels
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setUploadProgress(0);
    setUploadStatus('Starting upload...');
    setChannels([]);
    setAllMessages({});
    setMessages([]);
    setSelectedChannel(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Starting file upload:', file.name);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/x-ndjson'
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      console.log('Upload response received, starting to read chunks...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Finished reading all chunks');
          // Process any remaining data in the buffer
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer.trim());
              processChunk(data);
            } catch (e) {
              console.warn('Failed to parse remaining buffer:', buffer);
            }
          }
          break;
        }

        // Decode the chunk and add it to our buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Split on newlines and process complete lines
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || '';

        // Process each complete line
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line.trim());
              processChunk(data);
            } catch (e) {
              console.warn('Failed to parse line:', line);
            }
          }
        }
      }

      setUploadStatus('Upload complete!');
      console.log('Final channels state:', channels);
      console.log('Final messages state:', allMessages);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to process each chunk of data
  const processChunk = (data) => {
    if (!data || !data.type) {
      console.warn('Invalid chunk format:', data);
      return;
    }

    console.log('Processing chunk type:', data.type);

    if (data.type === 'error') {
      console.error('Error from server:', data.data?.message);
      setError(data.data?.message || 'Unknown error occurred');
      return;
    }

    if (data.type === 'channels') {
      console.log('Setting channels:', data.data);
      setChannels(data.data || []);
      setUploadStatus('Processing channels...');
    } else if (data.type === 'messages') {
      if (!data.channel || !Array.isArray(data.data)) {
        console.warn('Invalid message format:', data);
        return;
      }

      console.log(`Processing messages for channel: ${data.channel}, count:`, data.data.length);
      setUploadStatus(`Processing messages from ${data.channel}...`);
      setAllMessages(prev => {
        const channelMessages = prev[data.channel] || [];
        return {
          ...prev,
          [data.channel]: [...channelMessages, ...data.data]
        };
      });
    }
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  return (
    <Root>
      <CssBaseline />
      <Sidebar>
        <Typography variant="h6" sx={{ p: 2, color: 'white' }}>
          Time Period
        </Typography>
        <List>
          {channels.map((channel) => (
            <ListItem
              key={channel.id}
              button
              selected={selectedChannel === channel.name}
              onClick={() => handleChannelSelect(channel.name)}
              sx={{
                color: 'white',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'white', minWidth: '36px' }}>
                <AccessTimeIcon />
              </ListItemIcon>
              <ListItemText primary={channel.name} />
            </ListItem>
          ))}
        </List>
      </Sidebar>
      <MainContent>
        <Container maxWidth="lg">
          <SearchBox>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12}>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileUpload}
                  style={{ marginBottom: '16px' }}
                  disabled={loading}
                />
                {loading && (
                  <Box sx={{ width: '100%', mt: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      {uploadStatus}
                    </Typography>
                  </Box>
                )}
                {error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Search messages"
                  variant="outlined"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Enter search query (supports regex)"
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={() => {}}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Search'}
                </Button>
              </Grid>
            </Grid>
          </SearchBox>
          <MessageList>
            {selectedChannel ? (
              filteredMessages.length > 0 ? (
                <MessageGroup messages={filteredMessages} searchQuery={searchQuery} />
              ) : (
                <Typography variant="body1" sx={{ textAlign: 'center', color: '#616061', padding: '20px' }}>
                  {searchQuery ? "No messages match your search" : "No messages"}
                </Typography>
              )
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', color: '#616061', padding: '20px' }}>
                Select a channel to view messages
              </Typography>
            )}
          </MessageList>
        </Container>
      </MainContent>
    </Root>
  );
}

export default App;