import crypto from 'crypto';

export const generateRoomId = () => {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
};

export const validateRoomId = (roomId) => {
  return /^[A-Z0-9]{6}$/.test(roomId);
};

export const generateUserId = () => {
  return crypto.randomBytes(8).toString('hex');
}; 