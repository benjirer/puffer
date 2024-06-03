from django.contrib.auth.models import User
from django.contrib.auth import login
from django.http import HttpResponse
import random
import string
from accounts.models import UserSession


class AutoCreateUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if the user is authenticated
        if request.user.is_authenticated:
            try:
                user_session = UserSession.objects.get(user=request.user)
                if user_session.session_key != request.session.session_key:
                    return HttpResponse(
                        "Viewing multiple streams at the same time is not permitted, sorry."
                    )
            except UserSession.DoesNotExist:
                pass

        if not request.user.is_authenticated:
            # Automatically create a new user
            username = "".join(
                random.choices(string.ascii_lowercase + string.digits, k=8)
            )
            password = User.objects.make_random_password()
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(password)
                user.save()
                # Log the user in
                user.backend = "django.contrib.auth.backends.ModelBackend"
                login(request, user)

            # Create a new UserSession entry
            UserSession.objects.create(
                user=user, session_key=request.session.session_key
            )

        response = self.get_response(request)

        # Update or create UserSession for the authenticated user
        if request.user.is_authenticated:
            UserSession.objects.update_or_create(
                user=request.user, defaults={"session_key": request.session.session_key}
            )

        return response
