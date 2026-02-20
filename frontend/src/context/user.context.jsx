import React, { createContext, useState, useEffect } from 'react';
import axios from '../config/axios';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !user) {
            axios.get('/users/profile')
                .then(res => {
                    setUser(res.data.user);
                })
                .catch(err => {
                    console.log("Session expired or invalid token");
                    localStorage.removeItem('token');
                });
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};


