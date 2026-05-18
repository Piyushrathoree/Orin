import {mutation , query} from "./_generated/server";
import {v} from "convex/values";
import bcrypt from "bcryptjs";

const hashOwnerId = (value: string) => {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(value, salt);
};

export const createProject = mutation({ 
    args: { name: v.string() },
    handler: async (ctx , args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }
        const hashedOwnerId = hashOwnerId(identity.subject);
        const project = await ctx.db.insert("projects", {
            name: args.name,
            ownerId: hashedOwnerId,
        });
        return project;
    }   
});

export const getProject = query({
    args: {},
    handler: async (ctx) => {

        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }
        const projects = await ctx.db.query("projects").withIndex("by_owner").collect();
        return projects;
    }
});
