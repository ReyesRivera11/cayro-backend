import { SetMetadata } from "@nestjs/common";
import { Role } from "../roles/role.enum";

export const roles_key = "roles";
export const Roles = (...roles:Role[]) => SetMetadata(roles_key,roles);