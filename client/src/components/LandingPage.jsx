import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const [creatorName, setCreatorName] = useState('');
  const [joinerName, setJoinerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomType, setRoomType] = useState('public');
  const navigate = useNavigate();

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!creatorName.trim()) return alert('Please enter your name');
    const newRoomCode = generateRoomCode();
    localStorage.setItem('whiteboard-username', creatorName);
    localStorage.setItem('whiteboard-room', newRoomCode);
    navigate(`/room/${newRoomCode}?name=${encodeURIComponent(creatorName)}&creator=true`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!joinerName.trim()) return alert('Please enter your name');
    if (!roomCode.trim()) return alert('Please enter a room code');
    
    // Validate room code format (6 characters, alphanumeric)
    const roomCodeRegex = /^[A-Z0-9]{6}$/;
    if (!roomCodeRegex.test(roomCode.toUpperCase())) {
      alert('Room code must be 6 characters long and contain only letters and numbers');
      return;
    }
    
    localStorage.setItem('whiteboard-username', joinerName);
    localStorage.setItem('whiteboard-room', roomCode);
    navigate(`/room/${roomCode.toUpperCase()}?name=${encodeURIComponent(joinerName)}&creator=false`);
  };

  const handleJoinViaLink = () => {
    if (!joinerName.trim()) return alert('Please enter your name first');
    
    const roomCode = prompt('Enter the room code from the share link:');
    if (!roomCode) return;
    
    // Validate room code format (6 characters, alphanumeric)
    const roomCodeRegex = /^[A-Z0-9]{6}$/;
    if (!roomCodeRegex.test(roomCode.toUpperCase())) {
      alert('Room code must be 6 characters long and contain only letters and numbers');
      return;
    }
    
    localStorage.setItem('whiteboard-username', joinerName);
    localStorage.setItem('whiteboard-room', roomCode);
    navigate(`/room/${roomCode.toUpperCase()}?name=${encodeURIComponent(joinerName)}&creator=false`);
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <header className="landing-header">
          <h1 className="landing-title">Collaborative Whiteboard</h1>
          <p className="landing-subtitle">
            Draw, create, and collaborate in real-time with your team. Share ideas
            seamlessly on an infinite canvas.
          </p>
        </header>
        <div className="landing-main">
          <div className="join-section">
            <div className="forms-container">
              <div className="form-card">
                <h2 className="join-title">Create a New Room</h2>
                <form className="join-form" onSubmit={handleCreateRoom}>
                  <div className="form-group">
                    <label htmlFor="creator-name" className="form-label">Your Name</label>
                    <input
                      type="text"
                      id="creator-name"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      placeholder="Enter your name"
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="room-type" className="form-label">Room Type</label>
                    <select
                      id="room-type"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      className="form-input"
                    >
                      <option value="public">Public Room</option>
                      <option value="private">Private Room</option>
                    </select>
                  </div>
                  <button type="submit" className="create-room-btn">Create New Room</button>
                </form>
              </div>
              
              <div className="divider-vertical"></div>
              
              <div className="form-card">
                <h2 className="join-title">Join Existing Room</h2>
                <form className="join-form" onSubmit={handleJoinRoom}>
                  <div className="form-group">
                    <label htmlFor="joiner-name" className="form-label">Your Name</label>
                    <input
                      type="text"
                      id="joiner-name"
                      value={joinerName}
                      onChange={(e) => setJoinerName(e.target.value)}
                      placeholder="Enter your name"
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="room-code" className="form-label">Room Code</label>
                    <input
                      type="text"
                      id="room-code"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="Enter room code (e.g., ABC123)"
                      className="form-input"
                      maxLength="6"
                      pattern="[A-Z0-9]{6}"
                      required
                    />
                    <small className="form-hint">Room code must be 6 characters (letters and numbers)</small>
                  </div>
                  <button type="submit" className="join-room-btn">Join Existing Room</button>
                </form>
                <div className="join-link-section">
                  <p className="join-link-text">Or join via share link:</p>
                  <button 
                    type="button" 
                    className="join-link-btn"
                    onClick={handleJoinViaLink}
                    disabled={!joinerName.trim()}
                  >
                    🔗 Join via Link
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="features-section">
            <div className="feature-item">
              <div className="feature-icon">🚀</div>
              <h3 className="feature-title">Real-time Collaboration</h3>
              <p className="feature-description">
                See changes instantly as your team draws and edits together
              </p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎯</div>
              <h3 className="feature-title">Rich Drawing Tools</h3>
              <p className="feature-description">
                Pen, shapes, text, colors, and more tools for creative expression
              </p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Instant Sync</h3>
              <p className="feature-description">
                Lightning-fast synchronization powered by WebSocket technology
              </p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💎</div>
              <h3 className="feature-title">Persistent Storage</h3>
              <p className="feature-description">
                Your drawings and chat history are saved and restored automatically
              </p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🛡️</div>
              <h3 className="feature-title">Room Management</h3>
              <p className="feature-description">
                Create private rooms and manage user permissions
              </p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🌐</div>
              <h3 className="feature-title">Cross Platform</h3>
              <p className="feature-description">
                Works on desktop, tablet, and mobile devices
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
