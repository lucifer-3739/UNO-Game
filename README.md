# 🃏 UNO Online - Real-Time Multiplayer Card Game

A premium browser-based recreation of the classic **UNO** card game. Play locally against strategic AI players, or jump online with friends using matchmaking lobbies, private invite codes/links, and fully integrated **WebRTC Peer-to-Peer Voice Audio Chat**.

---

## ✨ Features

- **🎮 Game Modes:**
  - **Solo Mode:** Play offline against strategic, difficulty-tiered AI (Easy, Medium, Expert Hard).
  - **Online Multiplayer:** Host or join real-time lobbies supporting 2 to 4 players.
- **⚡ Real-Time Networking:** Powered by **Socket.IO** for synchronous, low-latency game state replication.
- **🔊 WebRTC Voice Chat:** Built-in peer-to-peer audio channels so you can talk, strategize, or call "UNO!" directly in-browser.
- **🏆 Global Leaderboard:** Dynamically tracks player scores, total games played, and round wins using a **Supabase PostgreSQL** database.
- **🎨 Premium Visuals & Effects:**
  - 3D hover card-tilting and smooth drawing/discarding animations (Framer Motion).
  - Authentic green-felt card table background.
  - Interactive color pickers and warning banners.
  - Contextual sounds for shuffling, drawing, playing cards, penalties, and wins.

---

## 🛠️ Technology Stack

- **Frontend:** Next.js 16.2 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS, CSS Custom Properties, Lucide Icons
- **State Management:** Zustand
- **Animations:** Framer Motion
- **Websockets:** Socket.IO & Socket.IO Client (replicates game state, turn-based actions, WebRTC signaling)
- **Voice Calling:** WebRTC (RTCPeerConnection, STUN channels)
- **Database & Auth:** Supabase (PostgreSQL tables, session tracking, Row Level Security)

---

## 🚀 Getting Started (Local Setup)

Follow these steps to run the game on your local machine:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org) (v18 or higher) installed.

### 2. Clone the Repository & Install Dependencies
```bash
git clone https://github.com/lucifer-3739/UNO-Game.git
cd UNO-Game
npm install
```

### 3. Setup Your Environment Variables
Create a file named `.env.local` in the root of the project:
```bash
# In D:/uno/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key-here
```
*Note: If these variables are not configured, the game will automatically fall back to simulated local session modes so you can still create lobbies and play multiplayer!*

### 4. Initialize the Database (Supabase)
To enable score tracking and the global leaderboard, you need to set up the database tables:
1. Go to your **Supabase Dashboard** -> Select your Project.
2. Open the **SQL Editor** on the left sidebar.
3. Open a **New Query**, paste the contents of the `supabase_schema.sql` file located in the root of this project, and click **Run**.

### 5. Enable Anonymous Auth in Supabase
The project uses Anonymous Sign-ins to assign secure player IDs:
1. In your **Supabase Dashboard**, navigate to **Authentication** -> **Providers**.
2. Select **Anonymous** from the list of Auth Providers.
3. Toggle **Enable Anonymous Sign-ins** to **ON** and click **Save**.

### 6. Run the Project
We use a custom server `server.js` to manage both Next.js and the WebSocket gateway on port 3000:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Open multiple windows (or an Incognito window) to test matchmaking and voice channels!

---

## 📖 UNO Custom Rules Implemented

- **Reverse Card:** With 3+ players, changes play direction. In a 2-player game, it behaves as a **Skip** (turns return to the current player).
- **Wild Draw 4 Challenge:** When a Wild Draw 4 is played, the recipient is hit with a +4 card draw.
- **Forgetting UNO Penalty:** If you have exactly 1 card left and do not call **UNO!** before playing it, other players can hit the **🎣 Catch!** button to penalize you with 2 extra cards.
- **Drawn Card Play:** If you draw a card from the deck, you can choose to play it immediately if eligible, or pass your turn.
