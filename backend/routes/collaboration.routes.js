import { Router } from 'express';
import { body } from 'express-validator';
import * as collaborationController from '../controllers/collaboration.controller.js';
import * as authMiddleWare from '../middleware/auth.middleware.js';

const router = Router();

router.post('/projects/:projectId/invite',
    authMiddleWare.authUser,
    body('email').isEmail().withMessage('Enter a valid email address'),
    collaborationController.inviteCollaborator
);

router.get('/notifications',
    authMiddleWare.authUser,
    collaborationController.getNotifications
);

router.post('/notifications/:requestId/respond',
    authMiddleWare.authUser,
    body('action').isIn(['accept', 'reject']).withMessage('Action must be either accept or reject'),
    collaborationController.respondToNotification
);

export default router;
