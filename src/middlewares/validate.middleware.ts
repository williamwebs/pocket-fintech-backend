import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, ZodType } from "zod";

export const validate = (schema: ZodType): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = schema.parse({
                body: req.body,
                query: req.query,
                params: req.params
            }) as { body?: unknown, query?: unknown, params?: unknown };

            if (parsed.body) req.body = parsed.body;
            if (parsed.query) Object.assign(req.query, parsed.query);
            if (parsed.params) req.params = parsed.params as any;

            next()
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    success: false,
                    error: error.issues.map((e)=> `${e.path.join(".")}: ${e.message}`).join(", ")
                })
            }
            next(error)  
        }
    }
}