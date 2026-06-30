import jsonwebtoken from "jsonwebtoken";

const generateToken = (userId: number) => {
    const token = jsonwebtoken.sign({userId}, process.env.JWT_SECRET as string, {
        expiresIn: "1h",
    });
    return token;
};

export {generateToken};