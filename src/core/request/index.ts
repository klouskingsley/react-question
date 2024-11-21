import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import {compile} from 'path-to-regexp'
import { memoryTokenManager } from "../token/token";

export type Response<T> =
  | {
      data: T;
      success: true;
      errorCode?: string;
      errorMessage?: string;
    }
  | {
      data?: T;
      success: false;
      errorCode: number;
      errorMessage: string;
    };

type ExtractKeys<T extends string> =
  T extends `${string}{${infer Key}}${infer Rest}`
    ? Key | ExtractKeys<Rest>
    : never;

type PathVariables<T extends string> = ExtractKeys<T> extends never
  ? Record<string, string | number>
  : Record<ExtractKeys<T>, string | number>;

type RequestConfig<
  D extends object,
  Q extends object,
  U extends string,
  P = PathVariables<U>
> = Omit<AxiosRequestConfig<D>, "url" | "params"> & {
  /**
   * @example '/api/:id' => pathVariables: { id: "1" }
   * @example '/api/:id/:name' => pathVariables: { id: "1", name: "2" }
   */
  url: U;
  ignoreAuth?: boolean; //不為true時 header需附帶Authentication value為token
  silentError?: boolean;
  throwError?: boolean;
  params?: Q;
  /**
   * @example '/api/:id' => { id: "1" }
   * @example '/api/:id/:name' => { id: "1", name: "2" }
   */
  pathVariables?: P;
};

export interface Request {
  <
    T,
    D extends object = any,
    Q extends object = any,
    U extends string = string,
    P = PathVariables<U>
  >(
    args: RequestConfig<D, Q, U, P>
  ): Promise<Response<T>>;
}

export function defaultResponseTransformer<T, D>(args: {
  axiosResponse?: AxiosResponse<T, D>
  axiosError?: AxiosError<T, D>
}): Response<T> {
  
  if (args.axiosResponse) {
    return args.axiosResponse.data as Response<T>;
  }
  const error = args.axiosError!;
  // refer: https://axios-http.com/docs/handling_errors
  if (error.response) {
    return {
      success: false,
      errorCode: error.response.status,
      errorMessage: error.response.statusText,
    }
  } else if (error.request) {
    return {
      success: false,
      errorCode: 1000,  // avoid collision with http status code
      errorMessage: error.message || 'The request was made but no response was received'
    }
  } else {
    return {
      success: false,
      errorCode: 1001,
      errorMessage: error.message || 'Unknown'
    }
  }
}


// D => request config.data
// T => response.data
export function createInstance(
  baseUrl: string,
  addTokenToRequest:  <D>(config: AxiosRequestConfig<D>) => Promise<Response<undefined>>,
  onError: <T>(res: Response<T>, silentError?: boolean) => void,
  responseTransformer: <T, D>(
    args: {
      axiosResponse?: AxiosResponse<T, D>
      axiosError?: AxiosError<T, D>
    }
  ) => Response<T>,
): Request {
  // create a new instance
  // if using the default axios instance here, 
  // some unexpected error may occurred when the default axios instance is polluted by apis like `interceptors`.
  const axiosInstance = axios.create()

  const request: Request = async <
    T = any,
    D extends object = any,
    Q extends object = any,
    U extends string = string,
    P = PathVariables<U>
  >(
    args: RequestConfig<D, Q, U, P>
  ) => {
    const {
      url,
      ignoreAuth,
      silentError,
      throwError,
      // params,
      pathVariables,
      ...axiosConfig
    } = args;

    const handleRes = <T>(res: Response<T>): Response<T> => {
      if (res.success) {
        return res;
      }

        
      onError(res, silentError);
      if (silentError) {
        console.log(`request error, errorCode=${res.errorCode}, errorMessage: ${res.errorMessage}`)
        return res;
      } else {
        throw res;
      }
    }

    let res: Response<T>
    const requestConfig: AxiosRequestConfig<D> = {
      ...axiosConfig,
      url: baseUrl + compile(url)(pathVariables as any),
    }

    // add token to request config
    {
      if (!ignoreAuth) {
        const authRes = await addTokenToRequest<D>(requestConfig);

        if (!authRes.success) {
          res = authRes as Response<T>
          return handleRes(res);
        }
      }
    }

    // make request
    try {
      const response = await axiosInstance.request(requestConfig);
      return handleRes(responseTransformer({axiosResponse: response}))
    } catch (err) {
      return handleRes(responseTransformer({axiosError: err as AxiosError<T>}))
    }
  };
  return request
}

const defaultBaseUrl = ''
let request = createInstance(
  defaultBaseUrl,
  memoryTokenManager.addTokenToRequest,
  (res, silentError) => {
    if (!silentError) {
      // toast here
      console.log(res.errorCode, res.errorMessage)
    }
  },
  defaultResponseTransformer
)

export default request;
