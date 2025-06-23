import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import './JoinRoom.css';

const JoinRoom = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get username from URL params if available
    const urlUsername = searchParams.get('name');
    const savedUsername = localStorage.getItem('whiteboard-username');
    
    if (urlUsername) {
      setUsername(urlUsername);
    } else if (savedUsername) {
      setUsername(savedUsername);
    }
  }, [searchParams]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!roomId) {
      setError('Invalid room ID');
      return;
    }

    setIsJoining(true);
    setError('');

    // Save username to localStorage
    localStorage.setItem('whiteboard-username', username);

    // Navigate to the room
    navigate(`/room/${roomId}?name=${encodeURIComponent(username)}`);
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      setError('Please enter a username first');
      return;
    }

    localStorage.setItem('whiteboard-username', username);
    navigate('/');
  };

  return (
    <div className="join-room-container">
      <div className="join-room-card">
        <div className="join-room-header">
          <h1>🎨 Join Whiteboard Room</h1>
          <p>Enter your name to join the collaborative whiteboard</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinRoom} className="join-form">
          <div className="form-group">
            <label htmlFor="username">Your Name</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="form-input"
              autoFocus
              maxLength={20}
            />
          </div>

          <div className="room-info">
            <div className="room-id-display">
              <span className="room-label">Room ID:</span>
              <span className="room-id">{roomId}</span>
            </div>
          </div>

          <div className="button-group">
            <button 
              type="submit" 
              className="join-btn"
              disabled={isJoining}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
            
            <button 
              type="button" 
              className="create-btn"
              onClick={handleCreateRoom}
            >
              Create New Room
            </button>
          </div>
        </form>

        <div className="join-room-footer">
          <p>Share this link with others to invite them to join!</p>
          <div className="share-link">
            <input
              type="text"
              value={`${window.location.origin}/join/${roomId}${username ? `?name=${encodeURIComponent(username)}` : ''}`}
              readOnly
              className="share-link-input"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}${username ? `?name=${encodeURIComponent(username)}` : ''}`);
                alert('Link copied to clipboard!');
              }}
              className="copy-link-btn"
            >
              📋
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom; 