import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env.js";

const port = env?.PORT ?? 3000;
const serverUrl = `http://localhost:${port}`;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Fintrack API",
      version: "1.0.0",
      description: "API de gestión financiera personal",
    },
    servers: [
      {
        url: serverUrl,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
