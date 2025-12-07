// Singleton socket client used across the app to avoid duplicate connections
import { io } from "socket.io-client";


const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3001";
const socket = io(SOCKET_URL, { autoConnect: true });


export default socket;