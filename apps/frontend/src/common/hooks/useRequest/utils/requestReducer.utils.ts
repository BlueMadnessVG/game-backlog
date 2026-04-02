import type { State, Action } from '../types/useRequest.type';

/**
 * Reducer to manage the fetch state machine.
 * Ensures atomic updates to prevent UI inconsistencies.
 */
export function requestReducer<TData>(state: State<TData>, action: Action<TData>): State<TData> {
  switch (action.type) {
    case 'FETCHING':
      return { ...state, isLoading: true, error: null, isSuccess: false };
    case 'SUCCESS':
      return { data: action.payload, isLoading: false, error: null, isSuccess: true };
    case 'ERROR':
      return { ...state, isLoading: false, error: action.payload, isSuccess: false };
    case 'RESET':
      return { data: null, isLoading: false, error: null, isSuccess: false };
    default:
      return state;
  }
}
