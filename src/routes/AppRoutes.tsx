import { Routes, Route } from "react-router-dom";

// Pages
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import Form from "@/pages/Form";
import Report from "@/pages/Report";
import History from "@/pages/History";
import Profile from "@/pages/Profile";
import NearbyDermatologists from "@/pages/NearbyDermatologists";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";

/**
 * Centralized application routes.
 * Landing internally redirects authenticated users to /home.
 */
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />

      {/* Authenticated home */}
      <Route path="/home" element={<Home />} />

      {/* Onboarding (profile completion) */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Core application */}
      <Route path="/upload" element={<Upload />} />
      <Route path="/form" element={<Form />} />
      <Route path="/report/:id" element={<Report />} />
      <Route path="/history" element={<History />} />
      <Route path="/nearby" element={<NearbyDermatologists />} />
      <Route path="/profile" element={<Profile />} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;