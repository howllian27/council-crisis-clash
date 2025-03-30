import asyncio
from game.supabase_client import *

async def verify_game_data(session_id: str):
    print(f"\nVerifying game data for session {session_id}")
    
    # Get game data
    game_data = get_game(session_id)
    print("\nGame Data:")
    print(f"Current Round: {game_data['current_round']}")
    print(f"Is Active: {game_data['is_active']}")
    print(f"Phase: {game_data['phase']}")
    print(f"Current Scenario: {game_data['current_scenario']}")
    
    # Get players
    players_data = get_players(session_id)
    print("\nPlayers:")
    for player in players_data:
        print(f"- {player['name']} (ID: {player['player_id']})")
        print(f"  Role: {player['role']}")
        print(f"  Active: {player['is_active']}")
        print(f"  Vote Weight: {player['vote_weight']}")
        print(f"  Has Voted: {player['has_voted']}")
    
    # Get resources
    resources_data = get_resources(session_id)
    print("\nResources:")
    for resource, value in resources_data.items():
        if resource not in ['id', 'session_id', 'created_at', 'updated_at']:
            print(f"- {resource}: {value}")
    
    # Get votes
    votes_data = get_votes(session_id, game_data['current_round'])
    print(f"\nVotes for Round {game_data['current_round']}:")
    for vote in votes_data:
        print(f"- Player {vote['player_id']}: {vote['vote']}")
    
    # Get secret incentives
    incentives_data = get_secret_incentives(session_id)
    print("\nSecret Incentives:")
    for incentive in incentives_data:
        print(f"- Player {incentive['player_id']}: {incentive['incentive']}")

if __name__ == "__main__":
    # Replace with the session ID from your game simulation
    SESSION_ID = "your_session_id_here"
    asyncio.run(verify_game_data(SESSION_ID)) 