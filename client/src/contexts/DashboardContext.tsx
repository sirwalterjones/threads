import React, { createContext, useContext, useState, useCallback } from 'react';

interface DashboardContextType {
  shouldRefreshFollowing: boolean;
  triggerFollowingRefresh: () => void;
  clearFollowingRefresh: () => void;
  lastFollowChange: number;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: React.ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const [shouldRefreshFollowing, setShouldRefreshFollowing] = useState(false);
  const [lastFollowChange, setLastFollowChange] = useState(Date.now());

  const triggerFollowingRefresh = useCallback(() => {
    console.log('Dashboard refresh triggered');
    setShouldRefreshFollowing(true);
    setLastFollowChange(Date.now());
  }, []);

  const clearFollowingRefresh = useCallback(() => {
    console.log('Dashboard refresh cleared');
    setShouldRefreshFollowing(false);
  }, []);

  const value = {
    shouldRefreshFollowing,
    triggerFollowingRefresh,
    clearFollowingRefresh,
    lastFollowChange
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export default DashboardContext;