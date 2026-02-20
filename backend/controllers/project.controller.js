import projectModel from '../models/project.model.js';
import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';
import catchAsync from '../utils/catchAsync.js';
import CustomError from '../utils/CustomError.js';

export const createProject = catchAsync(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return next(new CustomError(errors.array()[0].msg, 400));
    }

    const { name } = req.body;
    const loggedInUser = await userModel.findOne({ email: req.user.email });

    if (!loggedInUser) {
        return next(new CustomError('User not found', 404));
    }

    const userId = loggedInUser._id;
    const newProject = await projectService.createProject({ name, userId });

    res.status(201).json({
        status: 'success',
        data: newProject
    });
});

export const getAllProject = catchAsync(async (req, res, next) => {
    const loggedInUser = await userModel.findOne({
        email: req.user.email
    });

    if (!loggedInUser) {
        return next(new CustomError('User not found', 404));
    }

    const allUserProjects = await projectService.getAllProjectByUserId({
        userId: loggedInUser._id
    });

    res.status(200).json({
        status: 'success',
        results: allUserProjects.length,
        projects: allUserProjects
    });
});

export const addUserToProject = catchAsync(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return next(new CustomError(errors.array()[0].msg, 400));
    }

    const { projectId, users } = req.body;

    const loggedInUser = await userModel.findOne({
        email: req.user.email
    });

    if (!loggedInUser) {
        return next(new CustomError('User not found', 404));
    }

    const project = await projectService.addUsersToProject({
        projectId,
        users,
        userId: loggedInUser._id
    });

    res.status(200).json({
        status: 'success',
        project
    });
});

export const getProjectById = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await projectService.getProjectById({ projectId });

    if (!project) {
        return next(new CustomError('Project not found', 404));
    }

    res.status(200).json({
        status: 'success',
        project
    });
});

export const updateFileTree = catchAsync(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return next(new CustomError(errors.array()[0].msg, 400));
    }

    const { projectId, fileTree } = req.body;

    const project = await projectService.updateFileTree({
        projectId,
        fileTree
    });

    if (!project) {
        return next(new CustomError('Project not found', 404));
    }

    res.status(200).json({
        status: 'success',
        project
    });
});