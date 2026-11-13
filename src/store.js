import { configureStore, createSlice } from '@reduxjs/toolkit';

const readJourney = () => {
  try {
    return JSON.parse(localStorage.getItem('madararam-journey') || '{}');
  } catch {
    return {};
  }
};

const savedJourney = readJourney();
const journeySlice = createSlice({
  name: 'journey',
  initialState: { stage: savedJourney.stage || 'pregnancy', referenceDate: savedJourney.referenceDate || '', vaccineDate: savedJourney.vaccineDate || '', vaccineDone: Boolean(savedJourney.vaccineDone) },
  reducers: {
    setStage: (state, action) => { state.stage = action.payload; },
    setReferenceDate: (state, action) => { state.referenceDate = action.payload; },
    setVaccineDate: (state, action) => { state.vaccineDate = action.payload; state.vaccineDone = false; },
    setVaccineDone: (state, action) => { state.vaccineDone = action.payload; },
  },
});

const questionSlice = createSlice({
  name: 'question',
  initialState: { status: 'idle', message: '' },
  reducers: {
    setStatus: (state, action) => { state.status = action.payload; },
    setMessage: (state, action) => { state.message = action.payload; },
  },
});

export const { setStage, setReferenceDate, setVaccineDate, setVaccineDone } = journeySlice.actions;
export const { setStatus, setMessage } = questionSlice.actions;
export const store = configureStore({ reducer: { journey: journeySlice.reducer, question: questionSlice.reducer } });
store.subscribe(() => {
  const { stage, referenceDate, vaccineDate, vaccineDone } = store.getState().journey;
  try {
    localStorage.setItem('madararam-journey', JSON.stringify({ stage, referenceDate, vaccineDate, vaccineDone }));
  } catch {
    // The journey still works when browser storage is unavailable.
  }
});
