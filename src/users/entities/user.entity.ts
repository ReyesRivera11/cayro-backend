export interface Direction{
    street: string;
    city: string;
    country: string;
    neighborhood: string;
    references: string;
}

export interface Passwords{
    createdAt: Date;
    password: string;
}

export class User {
    name: string;
    surname: string;
    email: string;
    phone: string;
    birthday: Date;
    password: string;
    passwordSetAt?:Date;
    passwordExpiresAt?:Date;
    passwordsHistory?: Passwords[];
    gender?: string;
    direction?: Direction[];
    active?: boolean;
}
