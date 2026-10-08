import { z } from "astro/zod";

export const albumInfoSchema = z.object({
 mode: z.enum(["local", "external"]).optional(),
 title: z.string().optional(), description: z.string().optional(),
 cover: z.string().optional(), date: z.string().optional(),
 location: z.string().optional(), hidden: z.boolean().optional(),
 tags: z.array(z.string()).optional(),
 layout: z.enum(["grid", "masonry"]).optional(),
 columns: z.number().int().positive().optional(),
 photos: z.array(z.unknown()).optional(),
});

export const externalPhotoSchema = z.object({
 src: z.string().min(1), id: z.string().optional(),
 alt: z.string().optional(), title: z.string().optional(),
 thumbnail: z.string().optional(), description: z.string().optional(),
 date: z.string().optional(), location: z.string().optional(),
 tags: z.array(z.string()).optional(),
 width: z.number().positive().optional(), height: z.number().positive().optional(),
});
