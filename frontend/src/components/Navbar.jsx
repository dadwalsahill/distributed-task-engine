import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <div style={{ display: "flex", gap: 20, padding: 10, borderBottom: "1px solid" }}>
      <Link to="/">Dashboard</Link>
      <Link to="/submit">Submit</Link>
      <Link to="/analytics">Analytics</Link>
    </div>
  );
}