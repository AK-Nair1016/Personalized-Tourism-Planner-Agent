import { Request,Response,NextFunction } from "express";

const SUPPORTED_CITIES=['Dubai','Goa','Singapore','Bangkok'];

export function vaildateItineraryInput(
    req: Request,
    res: Response,
    next: NextFunction
){
    const{
        vibe,
        group,
        firstVisit,
        city,
        arrivalDate,
        departureDate,
        arrivalTime,
        departureTime,
        budget,
        pace,
         budgetSplit,

    }=req.body;
    if(!vibe || vibe.length==0){
        return res.status(400).json({ error: 'Vibe is required' });
    }

    if(!group){
        return res.status(400).json({ error: 'Group is required' });
    }
    
    if(!firstVisit==undefined || firstVisit=== null){
        return res.status(400).json({ error: 'firstVisit is required' });
    }

    if(!arrivalDate|| !departureDate){
        return res.status(400).json({ error: 'Arrival and departure dates is required' });
    }

    if(!arrivalTime|| departureTime){
        return res.status(400).json({ error: 'Arrival and departure time is required' });
    }

    if(!budget|| budget<=0){
        return res.status(400).json({ error: 'Budget is missing or too low is required' });
    }

    if(!pace){
        return res.status(400).json({ error: 'Pace is required' });
    }
    
    if(!budgetSplit){
        return res.status(400).json({ error: 'Budget split is required' });
    }
    next();
    
}