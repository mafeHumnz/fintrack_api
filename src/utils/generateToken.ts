import jsonwebtoken from "jsonwebtoken";
import {env} from "../config/env.js";

const generateToken = (userId: number) => {
    const token = jsonwebtoken.sign({userId}, env.JWT_SECRET, {
        expiresIn: "1h",
    });
    return token;
};

export {generateToken};