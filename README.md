# COLLABORATIVE-WHITEBOARD

## MongoDB Setup for Persistent Data

This project uses MongoDB for persistent storage. You must set the `MONGODB_URI` environment variable to connect to your MongoDB Atlas cluster or any live MongoDB instance.

### 1. Local Development
- Copy `.env.example` to `.env` in the `server` directory.
- Set `MONGODB_URI` to your MongoDB Atlas connection string:
  ```
  MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/whiteboard?retryWrites=true&w=majority
  ```
- Add any other required variables (see `.env.example`).

### 2. Deploying on Render or Railway
- When creating your web service, add an environment variable:
  - **Key:** `MONGODB_URI`
  - **Value:** *(your MongoDB Atlas connection string)*
- Add other variables as needed (e.g., `JWT_SECRET`, `CLIENT_URL`).

### 3. Example `.env.example`
See `server/.env.example` for a template.

---

## Quick Start

1. Clone the repo and install dependencies in both `client` and `server`.
2. Set up your `.env` files as described above.
3. Start the backend:
   ```sh
   cd server
   npm install
   npm start
   ```
4. Start the frontend:
   ```sh
   cd client
   npm install
   npm run dev
   ```

---

## Deployment

- **Frontend:** Deploy the `client` folder to Vercel.
- **Backend:** Deploy the `server` folder to Render or Railway. Set all required environment variables in the platform dashboard.