import { createContext } from "react";

interface DropContextType {
    fetchCart: () => Promise<void>;
    SignOut: () => Promise<void>;
}

const Context = createContext<DropContextType>({
    fetchCart: async () => {},
    SignOut: async () => {},
});

export default Context;
