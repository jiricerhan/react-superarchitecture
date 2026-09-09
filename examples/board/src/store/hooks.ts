import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

// typed base hooks; only module hooks.ts files import them
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
