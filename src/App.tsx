import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import FunnelList from "@/pages/FunnelList";
import FunnelAnalysis from "@/pages/FunnelAnalysis";
import ChurnAnalysis from "@/pages/ChurnAnalysis";
import ReportList from "@/pages/ReportList";
import ReportDetail from "@/pages/ReportDetail";
import MonitorConfig from "@/pages/MonitorConfig";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<FunnelList />} />
          <Route path="/funnel/:id" element={<FunnelAnalysis />} />
          <Route path="/funnel/:id/churn" element={<ChurnAnalysis />} />
          <Route path="/reports" element={<ReportList />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route path="/monitor" element={<MonitorConfig />} />
        </Route>
      </Routes>
    </Router>
  );
}
