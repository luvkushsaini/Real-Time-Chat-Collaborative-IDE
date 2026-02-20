import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {

    const { user } = useContext(UserContext)
    const [loading, setLoading] = useState(true)
    const token = localStorage.getItem('token')
    const navigate = useNavigate()




    useEffect(() => {
        if (!token) {
            navigate('/login')
            return
        }

        // Wait for user to be populated by UserProvider if token exists
        if (user) {
            setLoading(false)
        } else {
            // Check if user is still null after a short delay (gives UserProvider time to fetch profile)
            const timeout = setTimeout(() => {
                if (!user) {
                    navigate('/login')
                }
            }, 1000)
            return () => clearTimeout(timeout)
        }
    }, [user, token])

    if (loading) {
        return <div>Loading...</div>
    }


    return (
        <>
            {children}</>
    )
}

export default UserAuth