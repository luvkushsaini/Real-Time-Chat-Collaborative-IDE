import * as collaborationService from '../services/collaboration.service.js';
import userModel from '../models/user.model.js';
import catchAsync from '../utils/catchAsync.js';
import CustomError from '../utils/CustomError.js';
import { validationResult } from 'express-validator';

export const inviteCollaborator = catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new CustomError(errors.array()[0].msg, 400));
    }

    const { projectId } = req.params;
    const { email } = req.body;

    const loggedInUser = await userModel.findOne({ email: req.user.email });

    if (!loggedInUser) {
        return next(new CustomError('User not found', 404));
    }

    const invite = await collaborationService.createInvite({
        projectId,
        senderId: loggedInUser._id,
        receiverEmail: email
    });

    res.status(201).json({
        status: 'success',
        message: 'Invite sent successfully',
        data: invite
    });
});

export const getNotifications = catchAsync(async (req, res, next) => {
    const loggedInUser = await userModel.findOne({ email: req.user.email });

    const notifications = await collaborationService.getPendingNotifications({
        userId: loggedInUser._id
    });

    res.status(200).json({
        status: 'success',
        data: notifications
    });
});

export const respondToNotification = catchAsync(async (req, res, next) => {
    const { requestId } = req.params;
    const { action } = req.body;

    const loggedInUser = await userModel.findOne({ email: req.user.email });

    const result = await collaborationService.respondToInvite({
        requestId,
        userId: loggedInUser._id,
        action
    });

    res.status(200).json({
        status: 'success',
        message: `Invite ${action}ed successfully`,
        data: result
    });
});
