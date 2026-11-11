import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Vehicle, LoadPlan, User, Session, OAuthFlow } from './models/index.js';

export async function createStore(uri) {
  if (uri) {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    });
    return {
      mode: 'mongodb',
      listPlans: (ownerId) =>
        LoadPlan.find({ ownerId })
          .select('-result -packages')
          .sort({ updatedAt: -1 })
          .limit(100)
          .lean(),
      getPlan: (id, ownerId) =>
        mongoose.isValidObjectId(id)
          ? LoadPlan.findOne({ _id: id, ownerId }).lean()
          : null,
      createPlan: (data, ownerId) =>
        LoadPlan.create({ ...data, ownerId }).then((d) => d.toObject()),
      updatePlan: (id, data, ownerId) =>
        mongoose.isValidObjectId(id)
          ? LoadPlan.findOneAndUpdate(
              { _id: id, ownerId },
              {
                $set: Object.fromEntries(
                  ['name', 'vehicle', 'packages', 'result']
                    .filter((key) => data[key] !== undefined)
                    .map((key) => [key, data[key]]),
                ),
              },
              { new: true, runValidators: true, omitUndefined: true },
            ).lean()
          : null,
      deletePlan: (id, ownerId) =>
        mongoose.isValidObjectId(id)
          ? LoadPlan.findOneAndDelete({ _id: id, ownerId }).lean()
          : null,
      listVehicles: (ownerId) =>
        Vehicle.find({ ownerId }).sort({ createdAt: -1 }).limit(100).lean(),
      createVehicle: (data, ownerId) =>
        Vehicle.create({ ...data, ownerId }).then((d) => d.toObject()),
      upsertUser: ({ _id, ...data }) =>
        User.findOneAndUpdate(
          { _id },
          { $set: data },
          { new: true, upsert: true, runValidators: true },
        ).lean(),
      createSession: (_id, data) => Session.create({ _id, ...data }),
      getSession: (_id) =>
        Session.findOne({ _id, expiresAt: { $gt: new Date() } })
          .select('-_id -__v')
          .lean(),
      deleteSession: (_id) => Session.deleteOne({ _id }),
      createOAuthFlow: (_id, data) => OAuthFlow.create({ _id, ...data }),
      consumeOAuthFlow: (_id, browserHash) =>
        OAuthFlow.findOneAndDelete({
          _id,
          browserHash,
          expiresAt: { $gt: new Date() },
        }).lean(),
    };
  }
  const plans = new Map(),
    vehicles = new Map(),
    users = new Map(),
    sessions = new Map(),
    flows = new Map();
  const copy = (value) => (value == null ? null : structuredClone(value));
  const owned = (map, id, ownerId) =>
    map.get(id)?.ownerId === ownerId && ownerId ? map.get(id) : null;
  const record = (data, ownerId) => ({
    ...copy(data),
    ownerId,
    _id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const notExpired = (value) =>
    value && new Date(value.expiresAt) > new Date() ? copy(value) : null;
  const prune = (map) => {
    for (const [id, value] of map) if (!notExpired(value)) map.delete(id);
  };
  return {
    mode: 'memory',
    listPlans: async (ownerId) =>
      [...plans.values()]
        .filter((p) => p.ownerId === ownerId && ownerId)
        .reverse()
        .slice(0, 100)
        .map(({ packages, result, ...summary }) => copy(summary)),
    getPlan: async (id, ownerId) => copy(owned(plans, id, ownerId)),
    createPlan: async (data, ownerId) => {
      if (!ownerId) throw new Error('Owner required');
      const value = record(data, ownerId);
      plans.set(value._id, value);
      return copy(value);
    },
    updatePlan: async (id, data, ownerId) => {
      const previous = owned(plans, id, ownerId);
      if (!previous) return null;
      const value = {
        ...previous,
        ...copy(data),
        ownerId,
        _id: id,
        updatedAt: new Date().toISOString(),
      };
      plans.set(id, value);
      return copy(value);
    },
    deletePlan: async (id, ownerId) => {
      const value = owned(plans, id, ownerId);
      if (value) plans.delete(id);
      return copy(value);
    },
    listVehicles: async (ownerId) =>
      [...vehicles.values()]
        .filter((v) => v.ownerId === ownerId && ownerId)
        .slice(-100)
        .reverse()
        .map(copy),
    createVehicle: async (data, ownerId) => {
      if (!ownerId) throw new Error('Owner required');
      const value = record(data, ownerId);
      vehicles.set(value._id, value);
      return copy(value);
    },
    upsertUser: async (data) => {
      users.set(data._id, copy(data));
      return copy(data);
    },
    createSession: async (id, data) => {
      prune(sessions);
      sessions.set(id, copy(data));
    },
    getSession: async (id) => notExpired(sessions.get(id)),
    deleteSession: async (id) => sessions.delete(id),
    createOAuthFlow: async (id, data) => {
      prune(flows);
      flows.set(id, copy(data));
    },
    consumeOAuthFlow: async (id, browserHash) => {
      const flow = notExpired(flows.get(id));
      if (flow?.browserHash !== browserHash) return null;
      flows.delete(id);
      return flow;
    },
  };
}
