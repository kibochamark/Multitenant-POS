import { Prisma } from "generated/prisma/client"

export interface User {
    companyId: string
    kindeId: string
    name: string
    email: string
    phone?: string
    createdAt?: Date | null | string
}



export interface UserShopRole {
    userId: string
    shopId: string
    role: "OWNER" | "MANAGER" | "CASHIER"
}