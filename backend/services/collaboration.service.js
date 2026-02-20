import collaborationRequestModel from '../models/collaborationRequest.model.js';
import projectModel from '../models/project.model.js';
import userModel from '../models/user.model.js';
import mongoose from 'mongoose';
import CustomError from '../utils/CustomError.js';

export const createInvite = async ({ projectId, senderId, receiverEmail }) => {
    if (!projectId || !senderId || !receiverEmail) {
        throw new CustomError("Project ID, sender ID, and receiver email are required", 400);
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
        throw new CustomError("Project not found", 404);
    }

    const receiver = await userModel.findOne({ email: receiverEmail });
    if (!receiver) {
        throw new CustomError("Receiver user not found. Ensure they have signed up first.", 404);
    }

    if (senderId.toString() === receiver._id.toString()) {
        throw new CustomError("You cannot invite yourself", 400);
    }

    // Check if user is already a member
    if (project.users.includes(receiver._id)) {
        throw new CustomError("User is already a collaborator", 400);
    }

    // Check if there is already a pending invite
    const existingInvite = await collaborationRequestModel.findOne({
        project: projectId,
        receiver: receiver._id,
        status: 'pending'
    });

    if (existingInvite) {
        throw new CustomError("Invite already sent to this user", 400);
    }

    const invite = await collaborationRequestModel.create({
        project: projectId,
        sender: senderId,
        receiver: receiver._id,
        status: 'pending'
    });

    return invite;
};

export const getPendingNotifications = async ({ userId }) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    return await collaborationRequestModel.find({
        receiver: userId,
        status: 'pending'
    })
        .populate('project', 'name')
        .populate('sender', 'email');
};

export const respondToInvite = async ({ requestId, userId, action }) => {
    if (!requestId || !userId || !action) {
        throw new CustomError("Request ID, user ID, and action are required", 400);
    }

    const invite = await collaborationRequestModel.findOne({
        _id: requestId,
        receiver: userId,
        status: 'pending'
    });

    if (!invite) {
        throw new CustomError("Invite not found or already responded", 404);
    }

    if (action === 'accept') {
        invite.status = 'accepted';
        await invite.save();

        // Add user to project
        await projectModel.findByIdAndUpdate(invite.project, {
            $addToSet: { users: userId }
        });

        return { status: 'accepted', invite };
    } else if (action === 'reject') {
        invite.status = 'rejected';
        await invite.save();
        return { status: 'rejected', invite };
    } else {
        throw new CustomError("Invalid action", 400);
    }
};
