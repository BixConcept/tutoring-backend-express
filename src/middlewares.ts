import express from "express";
import {query} from "./index";
import platform from "platform";

// extracts PaginationInfo from query parameters
export function paginationInfo(req: express.Request, next: Function) {
    let nAny = req.query.n; // n parameter (can be pretty much any type)
    if (typeof nAny === "string") {
    } else if (typeof nAny === "undefined") {
        req.paginationInfo =
            {n: null, start: null};
        next();
        throw Error("n query parameter of invalid type");
    } else {
        throw Error("n query parameter of invalid type");
    }

    let n = parseInt(nAny)
    if (isNaN(n)) {
        throw Error("n query parameter is not a number");
    }

    let start = req.query.startAny;
    switch (typeof start) {
        case "string":
            break;
        case "undefined":
            req.paginationInfo =
                {n, start: null};
            next();
        default:
            throw new Error("start query parameter of invalid type");
    }

    req.paginationInfo = {n, start};
}

export async function logger(req: express.Request, _: any, next: any) {
    let frontendPath = req.headers["x-frontend-path"] || null;

    console.log(
        `${req.method} ${req.path} ${
            req.user === undefined ? 0 : req.user.authLevel
        } ${req.ip} ${req.user ? req.user.email + "#" + req.user.id : ""} ${
            frontendPath ? frontendPath : ""
        }`
    );

    let path = req.path;

    // spams the database
    if (req.path.startsWith("/user/email-available")) {
        return next();
    }

    if (req.path.match(/^\/user\/\d+/)) {
        path = "/user/:id";
    }

    const userAgent = req.headers["user-agent"] || null;

    let osType: string | null = null;
    let browserType: string | null = null;
    if (userAgent) {
        const parsed = platform.parse(userAgent);
        if (parsed) {
            osType = parsed.os?.family || null;
            browserType = parsed.name || null;
        }
    }

    try {
        await query(
            `INSERT INTO apiRequest (method, authLevel, path, ip, userAgent, frontendPath, osType, browserType)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.method || "",
                req.user === undefined ? 0 : req.user.authLevel,
                path,
                req.ip || "",
                userAgent,
                frontendPath,
                osType,
                browserType
            ]
        );
    } catch (e: any) {
        console.error("error logging:", e);
    }
    next();
}

