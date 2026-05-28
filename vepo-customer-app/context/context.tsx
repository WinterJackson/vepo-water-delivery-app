import { createContext } from "react";

interface VepoContextType {
    fetchCart: () => Promise<void>;
    SignOut: () => Promise<void>;
}

const Context = createContext<VepoContextType>({
    fetchCart: async () => {},
    SignOut: async () => {},
});

export default Context;
