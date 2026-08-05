import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, trackPageView } from '../utils/analytics';

export const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Initialize Google Analytics tag
    initGA();
  }, []);

  useEffect(() => {
    // Send pageview on route/query change
    const fullPath = location.pathname + location.search;
    trackPageView(fullPath);
  }, [location]);

  return null;
};
