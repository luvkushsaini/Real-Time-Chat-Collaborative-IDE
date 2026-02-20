import projectModel from '../models/project.model.js';
import mongoose from 'mongoose';
import CustomError from '../utils/CustomError.js';

export const createProject = async ({
    name, userId
}) => {
    if (!name) {
        throw new CustomError('Name is required', 400)
    }
    if (!userId) {
        throw new CustomError('UserId is required', 400)
    }

    let project;
    try {
        project = await projectModel.create({
            name,
            users: [userId]
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Project name already exists');
        }
        throw error;
    }

    return project;

}


export const getAllProjectByUserId = async ({ userId }) => {
    if (!userId) {
        throw new CustomError('UserId is required', 400)
    }

    const allUserProjects = await projectModel.find({
        users: userId
    })

    return allUserProjects
}

export const addUsersToProject = async ({ projectId, users, userId }) => {

    if (!projectId) {
        throw new CustomError("projectId is required", 400)
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new CustomError("Invalid projectId", 400)
    }

    if (!users) {
        throw new CustomError("users are required", 400)
    }

    if (!Array.isArray(users) || users.some(userId => !mongoose.Types.ObjectId.isValid(userId))) {
        throw new CustomError("Invalid userId(s) in users array", 400)
    }

    if (!userId) {
        throw new CustomError("userId is required", 400)
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new CustomError("Invalid userId", 400)
    }


    const project = await projectModel.findOne({
        _id: projectId,
        users: userId
    })

    console.log(project)

    if (!project) {
        throw new CustomError("User not belong to this project", 403)
    }

    const updatedProject = await projectModel.findOneAndUpdate({
        _id: projectId
    }, {
        $addToSet: {
            users: {
                $each: users
            }
        }
    }, {
        new: true
    })

    return updatedProject



}

export const getProjectById = async ({ projectId }) => {
    if (!projectId) {
        throw new CustomError("projectId is required", 400)
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new CustomError("Invalid projectId", 400)
    }

    const project = await projectModel.findOne({
        _id: projectId
    }).populate('users')

    return project;
}

export const updateFileTree = async ({ projectId, fileTree }) => {
    if (!projectId) {
        throw new CustomError("projectId is required", 400)
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new CustomError("Invalid projectId", 400)
    }

    if (!fileTree) {
        throw new CustomError("fileTree is required", 400)
    }

    const project = await projectModel.findOneAndUpdate({
        _id: projectId
    }, {
        fileTree
    }, {
        new: true
    })

    return project;
}