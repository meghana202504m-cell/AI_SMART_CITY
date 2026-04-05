import { useState } from "react";
import { reportIssue } from "../services/api";

function ReportForm() {
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!text.trim()) {
      setStatus({ type: "error", message: "Text is required." });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("text", text);
    if (location) formData.append("location", location);
    const storedUserId = window.localStorage.getItem("smartCityUserId");
    if (storedUserId) {
      formData.append("userId", storedUserId);
    }
    if (imageFile) formData.append("image", imageFile);

    const result = await reportIssue(formData);
    setLoading(false);

    if (result.success) {
      setStatus({ type: "success", message: "Report submitted." });
      setText("");
      setLocation("");
      setImageFile(null);
    } else {
      setStatus({ type: "error", message: result.error?.message || "Submit failed" });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Text</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div>
        <label>Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <label>Image</label>
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
      </div>
      <button type="submit" disabled={loading}>{loading ? "Sending..." : "Submit report"}</button>
      {status && <div style={{ color: status.type === "error" ? "red" : "green" }}>{status.message}</div>}
    </form>
  );
}

export default ReportForm;