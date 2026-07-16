import jwt, { SignOptions } from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.config";

export type JwtPayloadData = Record<string, unknown>;

export const generateToken = (
  payload: JwtPayloadData,
  expiresIn: SignOptions["expiresIn"] = jwtConfig.expiresIn as SignOptions["expiresIn"],
) => {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, jwtConfig.secret);
};
