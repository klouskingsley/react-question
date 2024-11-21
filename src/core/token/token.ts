import { AxiosRequestConfig } from "axios";
import {Response} from '../request'


type RefreshToken = (prevToken: InternalToken.Token) => Promise<InternalToken.Token>
interface TokenManager {
    updateToken: (token: InternalToken.Token) => void;
    deleteToken: () => void;
    addTokenToRequest: <D>(config: AxiosRequestConfig<D>) => Promise<Response<undefined>>
    setRefreshToken: (fn: RefreshToken) => void
    getToken: () => InternalToken.Token | null
}

function isTokenExpired(expireAt: number): boolean {
    return expireAt <= Date.now();
}



let memoryToken: InternalToken.Token | null;
export function createMemoryTokenManager(
) {
    let refreshToken: RefreshToken
    // call from login module after logining success,
    const updateToken = (_token: InternalToken.Token) => {
        memoryToken = _token;
    }
    // call from logout module after logout
    const deleteToken = () => {
        memoryToken = null;
    }
    const getToken = () => {
        return memoryToken;
    }

    // refreshToken function depends on request which depends on token manager, this cause the circle dependencies
    // to avoid circle dependencies, set the refreshToken function after token manager is created
    const setRefreshToken = (fn: RefreshToken) => {
        refreshToken = fn;
    }
    
    // call from src/core/request when auth token is needed
    const addTokenToRequest = async <D>(config: AxiosRequestConfig<D>): Promise<Response<undefined>> =>  {
        
        if (memoryToken) {
            if (
                !isTokenExpired(memoryToken.accessExpiredAt)
            ) {
                config.headers = config.headers || {}
                config.headers['Authorization'] = `Bearer ${memoryToken.access}`
                return {
                    success: true,
                    data: undefined
                }
            }

            if (
                isTokenExpired(memoryToken.refreshExpiredAt)
            ) {
                return {
                    success: false,
                    errorCode: 1100,
                    errorMessage: 'token expired'
                }
            }
            
            const token = await refreshToken(memoryToken);
            if (token) {
                memoryToken = token;
                config.headers = config.headers || {}
                config.headers['Authorization'] = `Bearer ${memoryToken.access}`
                return {
                    success: true,
                    data: undefined
                }
            } else {
                return {
                    success: false,
                    errorCode: 1101,
                    errorMessage: 'refresh failed'
                }
            }

        } else {
            return {
                success: false,
                errorCode: 1102,
                errorMessage: 'not login'
            }
        }
    }

    const manager: TokenManager = {
        updateToken,
        deleteToken,
        addTokenToRequest,
        setRefreshToken,
        getToken
    }
    return manager;
}

export const memoryTokenManager = createMemoryTokenManager();