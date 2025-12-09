import { useParams } from "react-router-dom";

export default function StudentClassAnalytics() {
  const { class_id } = useParams();

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">📘 Class Analytics</h1>
      <p className="text-gray-300">Class ID: {class_id}</p>
      <p className="text-gray-400 mt-2">This page will show detailed attendance for this class.</p>
    </div>
  );
}
