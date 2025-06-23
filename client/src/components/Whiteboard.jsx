import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Canvas from './Canvas';
import './Whiteboard.css';

const Whiteboard = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessagesRef, setChatMessagesRef] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [typingTimeoutRef, setTypingTimeoutRef] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [permission, setPermission] = useState('edit');
  const [isCreator, setIsCreator] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [clipboard, setClipboard] = useState([]);
  const [selectedElements, setSelectedElements] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  // Define clearSelection with useCallback to fix dependency issues
  const clearSelection = useCallback(() => {
    setSelectedElements([]);
  }, []);

  // Auto-scroll chat messages to bottom
  useEffect(() => {
    if (chatMessagesRef) {
      chatMessagesRef.scrollTop = chatMessagesRef.scrollHeight;
    }
  }, [chatMessages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (permission === 'view') return;
      
      // Copy selected elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedElements.length > 0) {
        e.preventDefault();
        const elementsToCopy = selectedElements.map(element => ({
          ...element,
          id: Date.now() + Math.random(),
          x: element.x + 20,
          y: element.y + 20
        }));
        setClipboard(elementsToCopy);
      }
      
      // Cut selected elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedElements.length > 0) {
        e.preventDefault();
        const elementsToCut = selectedElements.map(element => ({
          ...element,
          id: Date.now() + Math.random(),
          x: element.x + 20,
          y: element.y + 20
        }));
        setClipboard(elementsToCut);
        setElements(prev => prev.filter(element => !selectedElements.some(selected => selected.id === element.id)));
        setSelectedElements([]);
        if (socketRef.current && roomId) {
          socketRef.current.emit('drawing', elements.filter(element => !selectedElements.some(selected => selected.id === element.id)));
        }
      }
      
      // Paste elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        const pastedElements = clipboard.map(element => ({
          ...element,
          id: Date.now() + Math.random()
        }));
        setElements(prev => [...prev, ...pastedElements]);
        setSelectedElements(pastedElements);
        if (socketRef.current && roomId) {
          socketRef.current.emit('drawing', [...elements, ...pastedElements]);
        }
      }
      
      // Select all elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedElements([...elements]);
      }
      
      // Cancel freehand selection
      if (e.key === 'Escape' && selectedElements.length > 0) {
        e.preventDefault();
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElements, clipboard, elements, roomId, permission, clearSelection]);

  useEffect(() => {
    console.log('Whiteboard component mounted');
    console.log('Room ID:', roomId);
    console.log('Search params:', searchParams.toString());
    
    const currentUsername = searchParams.get('name') || localStorage.getItem('whiteboard-username') || 'Anonymous';
    const isCreatorParam = searchParams.get('creator') === 'true';
    
    console.log('Username:', currentUsername);
    console.log('Is Creator:', isCreatorParam);
    
    if (!roomId) {
      console.log('No room ID, navigating to home');
      navigate('/');
      return;
    }
    setUsername(currentUsername);
    setIsCreator(isCreatorParam);

    // Request notification permission for creators
    if (isCreatorParam && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Connect to socket with proper error handling
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    console.log('Connecting to backend:', backendUrl);
    
    socketRef.current = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    // Socket connection events
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server successfully');
      setIsConnected(true);
      
      // Join room after successful connection
      if (isCreatorParam) {
        console.log('Creating room:', roomId);
        // Create room if creator
        socketRef.current.emit('create-room', { 
          roomId, 
          username: currentUsername,
          roomType: 'public'
        });
      } else {
        console.log('Joining room:', roomId);
        // Join existing room
        socketRef.current.emit('join-room', { roomId, username: currentUsername });
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
      console.error('Connection error details:', {
        message: error.message,
        description: error.description,
        context: error.context
      });
    });

    // Room events
    socketRef.current.on('room-created', (data) => {
      console.log('✅ Room created successfully:', data);
      setRoomData(data.room);
      setUsers(data.users);
      setPermission(data.permission);
    });

    socketRef.current.on('room-joined', (data) => {
      console.log('✅ Room joined successfully:', data);
      setRoomData(data.room);
      setUsers(data.users);
      setPermission(data.permission);
    });

    socketRef.current.on('room-not-found', (data) => {
      console.error('❌ Room not found:', data);
      alert('Room not found! Please check the room ID.');
      navigate('/');
    });

    socketRef.current.on('error', (data) => {
      console.error('❌ Server error:', data);
      alert(`Server error: ${data.message}`);
    });

    // User management events
    socketRef.current.on('user-joined', (data) => {
      console.log('User joined:', data);
      setUsers(data.users);
    });

    socketRef.current.on('user-left', (data) => {
      console.log('User left:', data);
      setUsers(data.users);
    });

    // Drawing events
    socketRef.current.on('drawing', (data) => {
      console.log('Received drawing data:', data);
      setElements(data);
    });

    socketRef.current.on('clear-canvas', () => {
      console.log('Canvas cleared by another user');
      setElements([]);
      setHistory([]);
    });

    // Chat events
    socketRef.current.on('chat-message', (message) => {
      console.log('Received chat message:', message);
      setChatMessages(prev => [...prev, message]);
    });

    socketRef.current.on('user-typing', (data) => {
      console.log('User typing:', data);
      if (data.isTyping) {
        setTypingUsers(prev => {
          const existing = prev.find(u => u.username === data.username);
          if (existing) return prev;
          return [...prev, { username: data.username }];
        });
      } else {
        setTypingUsers(prev => prev.filter(u => u.username !== data.username));
      }
    });

    // Join request events
    socketRef.current.on('join-request', (data) => {
      console.log('Join request received:', data);
      setJoinRequests(prev => [...prev, data.request]);
      
      // Show notification for new join request
      if (isCreator) {
        // Show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Join Request', {
            body: `${data.request.username} wants to join the room`,
            icon: '/vite.svg'
          });
        }
        
        // Show visual notification
        alert(`New join request from ${data.request.username}! Click the 👥 button in the header to review.`);
      }
    });

    socketRef.current.on('join-request-pending', (data) => {
      console.log('Join request pending:', data);
      // Show a message to the user that their request is pending
      setIsWaitingForApproval(true);
    });

    socketRef.current.on('join-request-approved', (data) => {
      console.log('Join request approved:', data);
      setIsWaitingForApproval(false);
      setRoomData(data.room);
      setUsers(data.users);
      setPermission(data.permission);
    });

    socketRef.current.on('join-request-rejected', (data) => {
      console.log('Join request rejected:', data);
      setIsWaitingForApproval(false);
      alert('Your join request was rejected by the room leader.');
      navigate('/');
    });

    socketRef.current.on('join-request-responded', (data) => {
      console.log('Join request response:', data);
      // Remove the request from the list
      setJoinRequests(prev => prev.filter(req => req.id !== data.requestId));
    });

    // Cleanup function
    return () => {
      console.log('Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, searchParams, navigate]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !isConnected) return;
    
    const message = {
      message: chatInput,
      timestamp: new Date().toLocaleTimeString(),
      username
    };
    
    console.log('Sending chat message:', message);
    socketRef.current.emit("chat-message", message);
    socketRef.current.emit("user-typing", { username, isTyping: false });
    setChatInput("");
    
    // Clear typing timeout
    if (typingTimeoutRef) {
      clearTimeout(typingTimeoutRef);
      setTypingTimeoutRef(null);
    }
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    
    // Emit typing indicator
    if (isConnected) {
      socketRef.current.emit("user-typing", { username, isTyping: true });
      
      // Clear previous timeout
      if (typingTimeoutRef) {
        clearTimeout(typingTimeoutRef);
      }
      
      // Set timeout to stop typing indicator
      const timeout = setTimeout(() => {
        socketRef.current.emit("user-typing", { username, isTyping: false });
      }, 2000);
      setTypingTimeoutRef(timeout);
    }
  };

  const clearCanvas = () => {
    if (permission !== 'edit') return;
    
    setElements([]);
    setHistory([]);
    if (isConnected) {
      socketRef.current.emit("clear-canvas");
    }
  };

  const undo = () => {
    if (!elements.length || permission !== 'edit') return;
    const lastElement = elements[elements.length - 1];
    setHistory([...history, lastElement]);
    const newElements = elements.slice(0, -1);
    setElements(newElements);
    
    // Emit to server
    if (socketRef.current && isConnected) {
      socketRef.current.emit('drawing', newElements);
    }
  };

  const redo = () => {
    if (!history.length || permission !== 'edit') return;
    const lastHistoryElement = history[history.length - 1];
    const newElements = [...elements, lastHistoryElement];
    setElements(newElements);
    setHistory(history.slice(0, -1));
    
    // Emit to server
    if (socketRef.current && isConnected) {
      socketRef.current.emit('drawing', newElements);
    }
  };

  const downloadCanvas = () => {
    const canvas = document.querySelector('.whiteboard-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied to clipboard!');
  };

  const copyShareLink = () => {
    const shareLink = `${window.location.origin}/join/${roomId}?name=${encodeURIComponent(username)}`;
    navigator.clipboard.writeText(shareLink);
    alert('Share link copied to clipboard!');
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId, username });
    }
    navigate('/');
  };

  // Text functionality
  const handleTextClick = (e) => {
    if (tool === 'text') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTextPosition({ x, y });
      setShowTextInput(true);
    }
  };

  const addText = () => {
    if (textInput.trim()) {
      const newTextElement = {
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        text: textInput,
        color,
        size: brushSize,
        id: Date.now() + Math.random()
      };
      setElements(prev => [...prev, newTextElement]);
      setTextInput('');
      setShowTextInput(false);
      // Auto-select the new text element for immediate editing
      setSelectedElements([newTextElement]);
      setTool('scissors'); // Switch to scissors tool for editing
      if (socketRef.current && roomId) {
        socketRef.current.emit('drawing', [...elements, newTextElement]);
      }
    }
  };

  const handleJoinRequest = (requestId, approved) => {
    if (socketRef.current) {
      socketRef.current.emit('respond-join-request', {
        requestId,
        approved,
        roomId
      });
    }
  };

  const JoinRequestsModal = () => {
    if (!showJoinRequests || !isCreator || joinRequests.length === 0) return null;

    return (
      <div className="join-requests-modal">
        <div className="join-requests-content">
          <h3>Pending Join Requests ({joinRequests.length})</h3>
          <div className="join-requests-list">
            {joinRequests.map((request) => (
              <div key={request.id} className="join-request-item">
                <div className="request-info">
                  <span className="request-username">{request.username}</span>
                  <span className="request-time">
                    {new Date(request.requestedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="request-actions">
                  <button
                    onClick={() => handleJoinRequest(request.id, true)}
                    className="approve-btn"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleJoinRequest(request.id, false)}
                    className="reject-btn"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowJoinRequests(false)}
            className="close-modal-btn"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  if (!roomId) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading room...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Connecting to server...</p>
        <p className="connection-status">Backend URL: {import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}</p>
      </div>
    );
  }

  if (isWaitingForApproval) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Waiting for room leader approval...</p>
        <p className="approval-status">Your join request has been sent to the room leader.</p>
        <p className="approval-status">Please wait while they review your request.</p>
      </div>
    );
  }

  if (!roomData) {
    console.log('Whiteboard: No room data, showing loading screen');
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading room data...</p>
      </div>
    );
  }

  console.log('Whiteboard: Rendering whiteboard with room data:', roomData);
  console.log('Whiteboard: Elements count:', elements.length);
  console.log('Whiteboard: Users count:', users.length);
  console.log('Whiteboard: Is connected:', isConnected);

  return (
    <div className="whiteboard-container">
      <div className="whiteboard-header">
        <div className="room-info">
          <span>Room: <strong>{roomId}</strong></span>
          <span>Users: <strong>{users.length}</strong></span>
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          {permission === 'view' && (
            <span className="permission-badge">View Only</span>
          )}
          {isCreator && (
            <span className="creator-badge">Creator</span>
          )}
        </div>
        <div className="header-center">
          <div className="brand-logo">
            <span className="logo-icon">🎨</span>
            <span className="logo-text">Collaborative Whiteboard</span>
          </div>
        </div>
        <div className="user-info">
          <button onClick={copyRoomId} className="copy-btn" title="Copy Room ID">📋</button>
          <button onClick={copyShareLink} className="copy-btn" title="Copy Share Link">🔗</button>
          {isCreator && joinRequests.length > 0 && (
            <button 
              onClick={() => setShowJoinRequests(true)} 
              className="join-requests-btn"
              title={`${joinRequests.length} pending join request${joinRequests.length > 1 ? 's' : ''}`}
            >
              👥 {joinRequests.length}
            </button>
          )}
          <span>
            {username}
            <span className={`user-role ${isCreator ? 'leader' : 'member'}`}>
              {isCreator ? '(Leader)' : '(Member)'}
            </span>
          </span>
          <button onClick={leaveRoom} className="leave-btn">Leave</button>
        </div>
      </div>
      <div className="whiteboard-content">
        <div className="sidebar">
          <div className="users-section">
            <h3>👥 Online Users ({users.length})</h3>
            <div className="users-list">
              {users.map((user) => (
                <div key={user.id} className="user-item">
                  <div className="user-avatar">{user.username?.charAt(0).toUpperCase()}</div>
                  <div className="user-details">
                    <span className="user-name">
                      {user.username}
                      <span className={`user-role ${user.isCreator ? 'leader' : 'member'}`}>
                        {user.isCreator ? '(Leader)' : '(Member)'}
                      </span>
                    </span>
                    <div className="user-status">
                      {user.isCreator && <span className="creator-indicator">👑</span>}
                      {user.permission === 'view' && <span className="viewer-indicator">👁️</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="chat-section">
            <h3>💬 Chat</h3>
            <div className="chat-messages" ref={setChatMessagesRef}>
              {chatMessages.map((msg, i) => (
                <div key={i} className="chat-message">
                  <div className="message-header">
                    <strong>
                      {msg.username}
                      {users.find(u => u.username === msg.username)?.isCreator && (
                        <span className="user-role leader">(Leader)</span>
                      )}
                      {!users.find(u => u.username === msg.username)?.isCreator && (
                        <span className="user-role member">(Member)</span>
                      )}
                    </strong>
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                  <div className="message-content">{msg.message}</div>
                </div>
              ))}
              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  {typingUsers.map((user) => (
                    <span key={user.username} className="typing-user">
                      {user.username}
                      {users.find(u => u.username === user.username)?.isCreator && (
                        <span className="user-role leader">(Leader)</span>
                      )}
                      {!users.find(u => u.username === user.username)?.isCreator && (
                        <span className="user-role member">(Member)</span>
                      )}
                      {' '}is typing...
                    </span>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={sendMessage} className="chat-form">
              <input
                type="text"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder="Type a message..."
                className="chat-input"
                disabled={!isConnected}
              />
              <button type="submit" className="send-btn" disabled={!isConnected}>→</button>
            </form>
          </div>
        </div>
        <div className="main-content">
          <div className="toolbar">
            <div className="tool-group">
              <button 
                className={`tool-btn ${tool === 'pencil' ? 'active' : ''}`} 
                onClick={() => setTool('pencil')} 
                title="Pencil"
                disabled={permission === 'view'}
              >
                ✏️
              </button>
              <button 
                className={`tool-btn ${tool === 'rect' ? 'active' : ''}`} 
                onClick={() => setTool('rect')} 
                title="Rectangle"
                disabled={permission === 'view'}
              >
                ⬜
              </button>
              <button 
                className={`tool-btn ${tool === 'line' ? 'active' : ''}`} 
                onClick={() => setTool('line')} 
                title="Line"
                disabled={permission === 'view'}
              >
                ➖
              </button>
              <button 
                className={`tool-btn ${tool === 'circle' ? 'active' : ''}`} 
                onClick={() => setTool('circle')} 
                title="Circle"
                disabled={permission === 'view'}
              >
                ⭕
              </button>
              <button
                className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                onClick={() => setTool('eraser')}
                title="Eraser"
                disabled={permission === 'view'}
              >
                🧽
              </button>
            </div>
            <div className="color-group">
              {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'].map(c => (
                <button
                  key={c}
                  className={`color-btn ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  disabled={permission === 'view'}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="color-picker"
                title="Custom Color"
                disabled={permission === 'view'}
              />
            </div>
            <div className="size-group">
              <label>Size:</label>
              <select 
                value={brushSize} 
                onChange={e => setBrushSize(parseInt(e.target.value))}
                disabled={permission === 'view'}
              >
                {[1, 3, 5, 8, 12].map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </div>
            <div className="action-group">
              <button onClick={undo} disabled={!elements.length || permission === 'view'} className="action-btn" title="Undo">
                ↩️
              </button>
              <button onClick={redo} disabled={!history.length || permission === 'view'} className="action-btn" title="Redo">
                ↪️
              </button>
              <button onClick={clearCanvas} disabled={permission === 'view'} className="action-btn" title="Clear">
                🗑️
              </button>
              <button onClick={downloadCanvas} className="action-btn" title="Download">
                💾
              </button>
            </div>
          </div>
          <Canvas
            tool={tool}
            color={color}
            brushSize={brushSize}
            elements={elements}
            setElements={setElements}
            socket={socketRef.current}
            permission={permission}
            roomId={roomId}
            selectedElements={selectedElements}
            setSelectedElements={setSelectedElements}
            onTextClick={handleTextClick}
            setTool={setTool}
          />
        </div>
      </div>
      
      {/* Text Input Modal */}
      {showTextInput && (
        <div className="text-input-modal">
          <div className="text-input-content" style={{
            position: 'absolute',
            left: `${textPosition.x + 50}px`,
            top: `${textPosition.y - 50}px`,
            zIndex: 1000
          }}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              className="text-input"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addText();
                }
              }}
              onBlur={() => {
                if (textInput.trim()) {
                  addText();
                } else {
                  setShowTextInput(false);
                }
              }}
            />
          </div>
        </div>
      )}
      
      <JoinRequestsModal />
    </div>
  );
};

export default Whiteboard;
