import bcrypt from "bcrypt";
import {prisma} from "../config/prisma.js";
import {generateToken} from "../utils/generateToken.js";
import {env} from "../config/env.js";

interface RegisterData{
    name: string;
    email: string;
    password: string;
}

interface LoginData{
    email: string;
    password: string;
}

class AuthService {
    async register(data: RegisterData) {
        const {name, email, password} = data;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: {email},
        });

        if (existingUser) {
            throw new Error("User already exists");
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        const {password: _, ...userWithoutPassword} = user;

        return userWithoutPassword;
    }

    async login(data: LoginData) {
        const {email, password} = data;
        
        // Find the user by email
        const user = await prisma.user.findUnique({
            where: {email},
        });

        if (!user) {
            throw new Error("Invalid email or password");
        }

        // Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new Error("Invalid email or password");
        }

        // Generate a JWT token
        const token = generateToken(user.id);

        return {token};
    }
}

export default new AuthService();