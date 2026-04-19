🔥 Distributed Task Execution Engine

A scalable backend system that allows clients to submit long-running tasks and track their execution in real-time.

🚀 Features
Task submission with priority (1–5)
Worker pool with concurrency control
Real-time updates using SSE (Server-Sent Events)
Retry mechanism (max 3 retries)
Dead Letter Queue (DLQ) for failed tasks
Fair scheduling across multiple clients
Rate limiting (10 tasks/min per client)
Analytics dashboard

🏗️ Architecture
Client (UI)
   ↓
API (Express)
   ↓
Task Queue (Fair Scheduling)
   ↓
Worker Pool (Threads)
   ↓
Worker Execution
   ↓
SSE → UI (Real-time updates)
   ↓
MySQL (Persistence)

⚙️ Tech Stack
Backend: Node.js (Express)
Frontend: React (or Angular if required)
Database: MySQL
Concurrency: Worker Threads
Real-time: SSE
Containerization: Docker


▶️ How to Run Project
1. Clone repo
git clone https://github.com/dadwalsahill/distributed-task-engine.git
cd distributed-task-engine
2. Start project
docker-compose up --build
3. Access app
Frontend: http://localhost:5173
Backend API: http://localhost:3001

🧪 Testing Flow (IMPORTANT)
Step 1: Seed data

Click:
👉 "Seed 60 Tasks" button

Step 2: Observe
Tasks move from queued → running → completed
Workers become busy
Progress updates live
Step 3: Test features
✅ Cancel Task
Click cancel while running
✅ Retry Task
Retry from Dead Letter Queue
✅ Rate Limiting
Submit >10 tasks quickly → should get 429 error
⚖️ Fairness Mechanism

Implemented using Weighted Fair Queuing (WFQ):

Each client has its own queue
Scheduler picks client with lowest "virtual time"
Prevents one client from dominating system
Priority still respected within client queue
🔁 Retry & DLQ
If worker fails:
Retry up to 3 times
After that:
Task moves to Dead Letter Queue


### Dashboard
<img width="1440" height="943" alt="image" src="https://github.com/user-attachments/assets/b1837420-240a-47c5-96f5-de16554c8591" />
<img width="1887" height="902" alt="image" src="https://github.com/user-attachments/assets/507eeb61-8867-4cf9-b114-79aba89b0830" />

### Submit
<img width="1890" height="952" alt="image" src="https://github.com/user-attachments/assets/cb1d2af7-41ec-410f-bd7a-56d35ccf5353" />

### Analytics
<img width="1916" height="894" alt="image" src="https://github.com/user-attachments/assets/286bca54-5979-4cbb-822f-637c2248b543" />
