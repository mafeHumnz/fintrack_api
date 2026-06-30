import bcrypt from "bcrypt";
import {prisma} from "../config/prisma.js";
import {generateToken} from "../utils/generateToken.js";

interface registerUser{
    name: string;
    email: string;
    password: string;
}

interface loginUser{
    email: string;
    password: string;
}

export const register = async (user: registerUser) => {
    const {name, email, password} = user;

    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({
        where: {email},
    });

    if (existingUser) {
        throw new Error("User already exists");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    const newUser = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
        },
    });

    return newUser;
};

export const login = async (user: loginUser) => {
    const {email, password} = user;

    // Find the user by email
    const existingUser = await prisma.user.findUnique({
        where: {email},
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, existingUser.password);

    if (!isPasswordValid) {
        throw new Error("Invalid password");
    }

    const token = generateToken(existingUser.id);
    return token;
}

    