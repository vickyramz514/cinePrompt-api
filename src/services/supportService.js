/**
 * Customer Support Service - tickets and messaging
 */

import prisma from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export const createTicket = async (userId, { subject, message, priority = 'MEDIUM' }) => {
  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject,
      priority: priority || 'MEDIUM',
      messages: {
        create: {
          sender: 'USER',
          message,
        },
      },
    },
    include: {
      messages: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return ticket;
};

export const getMyTickets = async (userId, { status, limit = 20, offset = 0 } = {}) => {
  const where = { userId };
  if (status) where.status = status;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 1 },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return { tickets, total };
};

export const getTicketById = async (ticketId, userId) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  return ticket;
};

export const addUserMessage = async (ticketId, userId, message) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  if (ticket.status === 'CLOSED') throw new ValidationError('Cannot add message to closed ticket');

  const [updated, msg] = await prisma.$transaction([
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'IN_PROGRESS' },
    }),
    prisma.supportMessage.create({
      data: { ticketId, sender: 'USER', message },
    }),
  ]);
  return msg;
};

// Admin
export const getAdminTickets = async ({ status, priority, limit = 50, offset = 0 } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 1 },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return { tickets, total };
};

export const getAdminTicketById = async (ticketId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  return ticket;
};

export const addAdminMessage = async (ticketId, message) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  if (ticket.status === 'CLOSED') throw new ValidationError('Cannot add message to closed ticket');

  const msg = await prisma.supportMessage.create({
    data: { ticketId, sender: 'ADMIN', message },
  });
  return msg;
};

export const closeTicket = async (ticketId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) throw new NotFoundError('Ticket not found');

  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'CLOSED' },
  });
};
