from typing import Dict, List, Optional, Any, Tuple
import openai
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import json
import asyncio
import logging
import random

# Configure logging
logger = logging.getLogger(__name__)

load_dotenv()

class Scenario(BaseModel):
    title: str
    description: str
    options: List[str]
    resource_impacts: Dict[str, Dict[str, int]]

class ScenarioGenerator:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("OpenAI API key is not set in environment variables")
            raise ValueError("OpenAI API key is not set")
        logger.info("Initializing OpenAI client with API key: %s...", api_key[:8] + "..." if api_key else "None")
        try:
            # Initialize the client with async support
            self.client = openai.AsyncOpenAI(api_key=api_key)
            logger.info("OpenAI client initialized successfully")
            # Initialize conversation history dictionary to store messages for each game session
            self.conversation_history = {}
        except Exception as e:
            logger.error("Failed to initialize OpenAI client: %s", str(e))
            logger.error("Error type: %s", type(e))
            logger.error("Error details: %s", e.__dict__)
            raise
        
    async def generate_scenario(self, game_state: Dict) -> Tuple[str, str]:
        """
        Generate a scenario title and description.
        Returns a tuple of (title, description).
        """
        session_id = game_state.get('session_id')
        round_num = game_state.get('current_round', 1)
        
        # Get or initialize conversation history for this session
        if session_id not in self.conversation_history:
            self.conversation_history[session_id] = [
                {"role": "system", "content": "You are a creative game master generating scenarios for a futuristic government council game. Create engaging, morally complex situations that test the players' decision-making abilities but do so within 3-4 engaging sentences. DO NOT EXPLICITLY TELL PLAYERS THE CONSEQUENCES THAT WOULD OCCUR IN TERMS OF RESOURCES"}
            ]
        
        # Get the current conversation history
        messages = self.conversation_history[session_id]
        
        # Add the current game state context to the conversation
        context_prompt = self._create_scenario_prompt(game_state)
        
        # Check if we have a previous outcome to include in the context
        previous_outcome = None
        if round_num > 1 and 'current_scenario' in game_state and game_state['current_scenario']:
            if isinstance(game_state['current_scenario'], str):
                try:
                    scenario_data = json.loads(game_state['current_scenario'])
                    if 'outcome' in scenario_data:
                        previous_outcome = scenario_data['outcome']
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse scenario JSON: {game_state['current_scenario']}")
            elif isinstance(game_state['current_scenario'], dict) and 'outcome' in game_state['current_scenario']:
                previous_outcome = game_state['current_scenario']['outcome']
        
        # Add the user prompt to generate a new scenario
        user_prompt = f"Generate a new crisis for round {round_num} based on previous choices."
        if previous_outcome:
            user_prompt += f"\n\nPrevious outcome: {previous_outcome}"
        
        # Add the context and user prompt to the messages
        messages.append({"role": "user", "content": context_prompt})
        messages.append({"role": "user", "content": user_prompt})
        
        logger.info(f"Generating scenario for session {session_id}, round {round_num}")
        
        try:
            logger.info("Making OpenAI API call...")
            # Use async API call with the full conversation history and request JSON response
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.8,
                response_format={"type": "json_object"}  # Request JSON format
            )
            logger.info("OpenAI API call successful, processing response...")
            
            # Process response
            content = response.choices[0].message.content
            logger.info("Raw response content: %s", content)
            
            try:
                # Parse the JSON response
                scenario_data = json.loads(content)
                title = scenario_data.get("title", "")
                description = scenario_data.get("description", "")
                
                if not title or not description:
                    logger.error("Failed to generate complete scenario: Title or description is empty in JSON")
                    return self._create_fallback_scenario_text()
                
                logger.info(f"Generated scenario title: {title}")
                logger.info(f"Generated scenario description: {description}")
                
                # Add the assistant's response to the conversation history
                messages.append({"role": "assistant", "content": f"Scenario: {title}\n{description}"})
                
                return title, description
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                return self._create_fallback_scenario_text()
            
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI Authentication Error: {str(e)}")
            return self._create_fallback_scenario_text()
        except openai.RateLimitError as e:
            logger.error(f"OpenAI Rate Limit Error: {str(e)}")
            return self._create_fallback_scenario_text()
        except openai.APIError as e:
            logger.error(f"OpenAI API Error: {str(e)}")
            return self._create_fallback_scenario_text()
        except Exception as e:
            logger.error(f"Unexpected error generating scenario: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__}")
            return self._create_fallback_scenario_text()

    async def generate_voting_options(self, title: str, description: str) -> List[str]:
        """
        Generate voting options for the scenario.
        """
        try:
            prompt = f"""
            Create exactly 4 voting options for the following scenario:
            
            TITLE: {title}
            DESCRIPTION: {description}
            
            Each option should be a clear, concise action that the council could take.
            Return your response as a JSON object with an "options" array containing exactly 4 strings.
            """
            
            # Use async API call with JSON response format
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a game master creating voting options for a government council game. Create exactly 4 distinct options that represent different approaches to the scenario. DO NOT EXPLICITLY TELL PLAYERS THE CONSEQUENCES THAT WOULD OCCUR IN TERMS OF RESOURCES."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}  # Request JSON format
            )
            
            # Parse the options from the response
            options_text = response.choices[0].message.content
            logger.info(f"Raw voting options response: {options_text}")
            
            try:
                # Parse the JSON response
                options_data = json.loads(options_text)
                options = options_data.get("options", [])
                
                # Ensure we have exactly 4 options
                if len(options) < 4:
                    # Add fallback options if needed
                    while len(options) < 4:
                        options.append(f"Option {len(options) + 1}")
                elif len(options) > 4:
                    # Trim to 4 options
                    options = options[:4]
                
                logger.info(f"Generated voting options: {options}")
                return options
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response for options: {str(e)}")
                return self._create_fallback_options()
            
        except Exception as e:
            logger.error(f"Error generating voting options: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__}")
            # Return fallback options
            return self._create_fallback_options()

    def _create_scenario_prompt(self, game_state: Dict) -> str:
        return f"""
        Create a new scenario for the government council game with the following context:
        
        Current Round: {game_state.get('current_round', 1)}
        Resources:
        - Tech: {game_state.get('resources', {}).get('tech', 100)}
        - Manpower: {game_state.get('resources', {}).get('manpower', 100)}
        - Economy: {game_state.get('resources', {}).get('economy', 100)}
        - Happiness: {game_state.get('resources', {}).get('happiness', 100)}
        - Trust: {game_state.get('resources', {}).get('trust', 100)}
        
        Number of Players: {len(game_state.get('players', {}))}
        
        Create a scenario that:
        1. Is morally complex and engaging
        2. Has clear resource implications
        3. Involves multiple stakeholders
        4. Has potential for betrayal or cooperation
        5. Themes of absurdity and scifi
        6. 3-4 engaging sentences
        
        Return your response as a JSON object with the following structure:
        {{"title": "A short, attention-grabbing title", "description": "A detailed description of the scenario"}}
        """

    def _create_fallback_scenario_text(self) -> Tuple[str, str]:
        return (
            "Critical System Failure",
            "A critical system failure threatens the city's power grid. The council must decide how to allocate limited resources to address this crisis."
        )

    def _create_fallback_options(self) -> List[str]:
        return [
            "Option 1",
            "Option 2",
            "Option 3",
            "Option 4"
        ]
        
    async def generate_voting_outcome(self, title: str, description: str, winning_option: str, vote_counts: Dict[str, int]) -> Tuple[str, Dict[str, int]]:
        """
        Generate an outcome narrative based on the scenario and voting results.
        Returns a tuple of (outcome_narrative, resource_changes).
        """
        try:
            # Format vote counts for the prompt
            vote_summary = "\n".join([f"- {option}: {count} votes" for option, count in vote_counts.items()])
            
            prompt = f"""
            Create a narrative outcome for the following scenario and voting results:
            
            TITLE: {title}
            DESCRIPTION: {description}
            
            VOTING RESULTS:
            {vote_summary}
            
            WINNING OPTION: {winning_option}
            
            Create a narrative that:
            1. Describes what happened after the council made their decision
            2. Explains the consequences of their choice
            3. Is 3-4 sentences long
            4. Has a dramatic and engaging tone
            
            Also, determine how this outcome affects the following resources (each should increase or decrease by at least 10 points at once and max 40 points):
            - tech: technological advancement and infrastructure
            - manpower: available workforce and personnel
            - economy: financial resources and economic stability
            - happiness: public satisfaction and morale
            - trust: public trust in the council
            
            Return your response as a JSON object with the following structure:
            {{
                "outcome": "Your narrative outcome text here",
                "resource_changes": {{
                    "tech": number,
                    "manpower": number,
                    "economy": number,
                    "happiness": number,
                    "trust": number
                }}
            }}
            """
            
            # Use async API call with JSON response format
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a game master creating narrative outcomes for a government council game. Create engaging outcomes that describe the consequences of the council's decisions."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}  # Request JSON format
            )
            
            # Get the outcome from the response
            content = response.choices[0].message.content.strip()
            
            try:
                # Parse the JSON response
                outcome_data = json.loads(content)
                outcome = outcome_data.get("outcome", "")
                resource_changes = outcome_data.get("resource_changes", {})
                
                if not outcome:
                    logger.error("Failed to generate outcome: Outcome is empty in JSON")
                    return self._create_fallback_outcome()
                
                logger.info(f"Generated voting outcome: {outcome}")
                logger.info(f"Resource changes: {resource_changes}")
                
                # Add the outcome to the conversation history for all sessions
                for session_id in self.conversation_history:
                    self.conversation_history[session_id].append({"role": "user", "content": f"Option {winning_option}"})
                    self.conversation_history[session_id].append({"role": "assistant", "content": f"Outcome: {outcome}"})
                
                return outcome, resource_changes
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response for outcome: {str(e)}")
                return self._create_fallback_outcome()
            
        except Exception as e:
            logger.error(f"Error generating voting outcome: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__}")
            # Return a fallback outcome
            return self._create_fallback_outcome()

    async def generate_secret_incentive(self, scenario_title: str, scenario_description: str) -> dict:
        """
        Generate a secret incentive text that thematically aligns with the scenario.
        The returned dict includes:
        - "incentive": a short string describing the hidden objective,
        - "target_option": which option (e.g. "option1") the player must choose,
        - "bonus_weight": a float (between -0.5 and +0.5) indicating the bonus that will be permanently added to the player's voting weight.
        
        The AI must choose the target option from these four options: "option1", "option2", "option3", "option4"
        and explicitly instruct the selected player that if they vote for the chosen option, they will receive the bonus.
        """
        try:
            # Build the AI prompt. We do not select the option or bonus weight in our code now.
            prompt = f"""
            You are a game master generating a secret incentive for a futuristic government council scenario.
            The scenario is:
            TITLE: {scenario_title}
            DESCRIPTION: {scenario_description}

            Based solely on the narrative above, decide which voting option, from "option1", "option2", "option3", "option4",
            would best further the hidden objective. Also, choose an appropriate bonus weight (a floating point number 
            between -0.5 and +0.5) that will be added permanently to the player's voting weight if they vote for the chosen option.
            Write one or two sentences of engaging story that instruct the selected player that if they vote for the chosen 
            option, they will receive the extra bonus (e.g. "+0.3 voting weight"). The story can be dramatic or realistic but must be concise
            
            Return your response as a JSON object with EXACTLY these three keys:
            "incentive", "target_option", "bonus_weight".
            The "incentive" should be the short narrative text, "target_option" the option string (e.g. "option2"), 
            and "bonus_weight" the number.
            """

            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful assistant that returns a JSON object with exactly the keys "
                            "'incentive', 'target_option', and 'bonus_weight'. Do not include any additional text."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            logger.info(f"Raw AI incentive response: {content}")

            # Parse the AI response into a JSON object.
            data = json.loads(content)
            incentive_text = data.get("incentive", "").strip()
            target_opt = data.get("target_option", "").strip()
            weight_str = data.get("bonus_weight", "0")

            if not incentive_text or not target_opt or weight_str is None:
                raise ValueError("Missing incentive, target_option, or bonus_weight from AI output.")

            bonus_w = float(weight_str)

            return {
                "incentive": incentive_text,
                "target_option": target_opt,
                "bonus_weight": bonus_w
            }

        except Exception as e:
            logger.error(f"Error generating secret incentive: {str(e)}")
            # Fallback incentive if something goes wrong.
            return {
                "incentive": "Secretly align with shadowy interests. Vote for option1 to gain +0.2 voting weight for the rest of the game.",
                "target_option": "option1",
                "bonus_weight": 0.2
            }

            
    def _create_fallback_outcome(self) -> Tuple[str, Dict[str, int]]:
        return (
            "The council's decision led to mixed results. Some resources were improved while others suffered. The situation remains unresolved, and the council must prepare for future challenges.",
            {
                "tech": 0,
                "manpower": 0,
                "economy": 0,
                "happiness": 0,
                "trust": 0
            }
        )
    
    def clear_conversation_history(self, session_id: str):
        """
        Clear the conversation history for a specific session.
        """
        if session_id in self.conversation_history:
            del self.conversation_history[session_id]
            logger.info(f"Cleared conversation history for session {session_id}")

# Create a singleton instance
scenario_generator = ScenarioGenerator()
