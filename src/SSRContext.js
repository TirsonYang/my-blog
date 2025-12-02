import React, { createContext, useContext } from 'react';

const SSRContext = createContext(null);

export const SSRProvider = ({ value, children }) => {
  return <SSRContext.Provider value={value}>{children}</SSRContext.Provider>;
};

export const useSSRData = () => {
  return useContext(SSRContext);
};
