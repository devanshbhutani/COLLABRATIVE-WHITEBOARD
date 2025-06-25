This project is a real-time collaborative whiteboard built with React (Vite) on the frontend and Node.js + Socket.io + MongoDB on the backend. It enables multiple users to draw, chat, and share ideas instantly in shared rooms, making it ideal for remote teams, classrooms, and brainstorming sessions.
Key Features
Real-Time Drawing: Draw freehand, rectangles, lines, and circles on a shared canvas. All changes sync instantly across all users in the same room.
Shape Manipulation: Select, move, and resize shapes after drawing for precise adjustments.
Color & Size Picker: Choose from preset colors or a custom color picker and set brush sizes for creative flexibility.
Persistent Rooms: Each whiteboard session is tied to a unique room code. Users can join existing rooms or create new ones.
Live Chat: Integrated chat panel for instant messaging with everyone in the room.
User Presence: See who else is online and collaborating in real time.
History & Persistence: Drawing and chat history are saved in MongoDB, so new users joining a room see the full session history.
Responsive UI: Clean, modern interface that works seamlessly on desktop and mobile browsers.
Tech Stack
Frontend: React (Vite), modern CSS, Socket.io-client
Backend: Node.js, Express, Socket.io, MongoDB (Mongoose)
Hosting: Vercel/Netlify (frontend), Render/Heroku (backend), MongoDB Atlas (database)
How It Works
Users join or create a room via a unique code.
All drawing and chat actions are broadcast in real time via Socket.io.
The backend saves all drawing elements and chat messages to MongoDB for persistence.
When a new user joins a room, they receive the full drawing and chat history instantly.


DEPLOYED LINK : https://collabrative-whiteboard-git-main-devansh-bhutani-s-projects.vercel.app
